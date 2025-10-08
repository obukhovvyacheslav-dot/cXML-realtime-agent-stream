/**
 * Centralized Logger Utility
 *
 * Provides consistent logging throughout the application with support
 * for different log levels and debug mode via DEBUG environment variable.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogMessage {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';
  private debugEnabled = process.env.DEBUG?.includes('openai-agents') || false;

  private formatMessage(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toISOString();

    // In production, output structured JSON logs
    if (!this.isDevelopment) {
      const logMessage: LogMessage = {
        level,
        message,
        data,
        timestamp
      };
      console.log(JSON.stringify(logMessage));
      return;
    }

    // In development, use pretty formatting
    switch (level) {
      case 'error':
        console.error(`❌ ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`⚠️  ${message}`, data || '');
        break;
      case 'debug':
        if (this.debugEnabled) {
          console.log(`🔍 [DEBUG] ${message}`, data || '');
        }
        break;
      case 'info':
      default:
        console.log(message, data || '');
        break;
    }
  }

  info(message: string, data?: any): void {
    this.formatMessage('info', message, data);
  }

  error(message: string, data?: any): void {
    this.formatMessage('error', message, data);
  }

  warn(message: string, data?: any): void {
    this.formatMessage('warn', message, data);
  }

  debug(message: string, data?: any): void {
    this.formatMessage('debug', message, data);
  }

  // Special formatted outputs for better visibility
  divider(): void {
    if (this.isDevelopment) {
      console.log('═══════════════════════════════════════════════════════════');
    }
  }

  section(title: string, lines: string[]): void {
    if (this.isDevelopment) {
      this.divider();
      console.log(title);
      this.divider();
      lines.forEach(line => console.log(line));
      this.divider();
    } else {
      this.info(title, { details: lines });
    }
  }

  event(emoji: string, title: string, data?: any): void {
    if (this.isDevelopment) {
      console.log(`\n${emoji} ${title}`, data ? JSON.stringify(data, null, 2) : '');
    } else {
      this.info(title, data);
    }
  }
}

export const logger = new Logger();