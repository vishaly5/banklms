import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { logger } from '../../config/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '../../..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..');
const TRANSCRIBE_SCRIPT = path.join(BACKEND_ROOT, 'scripts', 'nvidia-riva-transcribe.py');
const DEFAULT_PYTHON = process.platform === 'win32'
  ? path.join(REPO_ROOT, 'ai-service', '.venv', 'Scripts', 'python.exe')
  : path.join(REPO_ROOT, 'ai-service', '.venv', 'bin', 'python');

const runProcess = (command, args, timeoutMs = 240000) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    env: {
      ...process.env,
      GRPC_DNS_RESOLVER: process.env.GRPC_DNS_RESOLVER || 'native',
    },
    windowsHide: true,
  });
  let stdout = '';
  let stderr = '';
  const timer = setTimeout(() => {
    child.kill('SIGKILL');
    reject(new Error(`Process timed out: ${path.basename(command)}`));
  }, timeoutMs);

  child.stdout.on('data', (data) => { stdout += data.toString(); });
  child.stderr.on('data', (data) => { stderr += data.toString(); });
  child.on('error', (error) => {
    clearTimeout(timer);
    reject(error);
  });
  child.on('close', (code) => {
    clearTimeout(timer);
    if (code === 0) resolve({ stdout, stderr });
    else reject(new Error(stderr || stdout || `${path.basename(command)} exited with code ${code}`));
  });
});

const getWavDurationSeconds = (wavPath) => {
  try {
    const stats = fs.statSync(wavPath);
    // Pipeline extracts 16kHz mono 16-bit PCM WAV; subtract the common WAV header.
    return Math.max(0, (stats.size - 44) / (16000 * 2));
  } catch {
    return 0;
  }
};

const buildFallbackSegments = (text = '', durationSeconds = 0) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const chunks = sentences.length ? sentences : clean.match(/.{1,220}(?:\s|$)/g)?.map((item) => item.trim()).filter(Boolean) || [clean];
  const totalChars = chunks.reduce((sum, item) => sum + item.length, 0) || clean.length;
  let cursor = 0;
  return chunks.map((chunk, index) => {
    const share = durationSeconds > 0 ? (chunk.length / totalChars) * durationSeconds : 0;
    const start = cursor;
    const end = index === chunks.length - 1 && durationSeconds > 0
      ? durationSeconds
      : cursor + Math.max(share, durationSeconds > 0 ? 1 : 0);
    cursor = end;
    return {
      start: Number(start.toFixed(2)),
      end: Number(end.toFixed(2)),
      text: chunk,
      confidence: null,
      synthetic: true,
    };
  });
};

const RIVA_LANGUAGE_CODES = {
  auto: 'en-US',
  en: 'en-US',
  'en-us': 'en-US',
  hi: 'hi-IN',
  hindi: 'hi-IN',
  hinglish: 'hi-IN',
  bn: 'bn-IN',
  bengali: 'bn-IN',
  te: 'te-IN',
  telugu: 'te-IN',
  mr: 'mr-IN',
  marathi: 'mr-IN',
  ta: 'ta-IN',
  tamil: 'ta-IN',
  gu: 'gu-IN',
  gujarati: 'gu-IN',
  kn: 'kn-IN',
  kannada: 'kn-IN',
  ml: 'ml-IN',
  malayalam: 'ml-IN',
  or: 'or-IN',
  od: 'or-IN',
  odia: 'or-IN',
  pa: 'pa-IN',
  punjabi: 'pa-IN',
  ur: 'ur-IN',
  urdu: 'ur-IN',
  as: 'as-IN',
  assamese: 'as-IN',
  other_indian: 'hi-IN',
};

const normalizeRivaLanguageCode = (value = 'auto') => {
  const raw = String(value || 'auto').trim();
  const mapped = RIVA_LANGUAGE_CODES[raw.toLowerCase()];
  if (mapped) return mapped;
  if (/^[a-z]{2}-[A-Z]{2}$/.test(raw)) return raw;
  logger.warn('[RIVA-PROVIDER] Unknown language hint; falling back to en-US', { languageHint: raw });
  return 'en-US';
};

export class RivaAsrProvider {
  constructor() {
    this.name = 'riva';
  }

  async transcribe(wavPath, options = {}) {
    logger.info('[RIVA-PROVIDER] Starting Riva ASR', { wavPath, options });
    const python = process.env.AI_SERVICE_PYTHON || (fs.existsSync(DEFAULT_PYTHON) ? DEFAULT_PYTHON : 'python');
    
    const langCode = normalizeRivaLanguageCode(options.language || options.languageHint || 'auto');

    try {
      const { stdout } = await runProcess(python, [
        TRANSCRIBE_SCRIPT,
        '--input', wavPath,
        '--server', process.env.NVIDIA_ASR_SERVER || 'grpc.nvcf.nvidia.com:443',
        '--function-id', process.env.NVIDIA_ASR_FUNCTION_ID || 'b702f636-f60c-4a3d-a6f4-f3568c13bd7d',
        '--language-code', langCode,
      ], Number(process.env.VIDEO_TRANSCRIPTION_TIMEOUT_MS || 240000));

      const parsed = JSON.parse(stdout.trim());
      if (!parsed.success || !parsed.text) {
        throw new Error(parsed.error || 'Riva returned no text');
      }
      const duration = getWavDurationSeconds(wavPath);
      const segments = parsed.segments?.length
        ? parsed.segments
        : buildFallbackSegments(parsed.text, duration);

      return {
        success: true,
        provider: this.name,
        language: langCode,
        text: parsed.text,
        segments,
        duration,
      };
    } catch (err) {
      logger.error('[RIVA-PROVIDER] Riva transcription failed', { error: err.message });
      throw err;
    }
  }
}
export default RivaAsrProvider;
