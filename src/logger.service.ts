import {
  LoggerService,
  Injectable,
  ConsoleLogger,
  LogLevel,
} from '@nestjs/common';
import * as fs from 'fs';
import * as p from 'path';

@Injectable()
export class CustomLogger extends ConsoleLogger implements LoggerService {
  private readonly _path: string = p.join(
    process.cwd(),
    'public/logs',
    'app.log',
  );

  constructor(context?: string) {
    super();
    this.setLogLevels(['log', 'warn', 'error', 'debug']);
    this.setContext(context);
  }

  log(message: string, ...optionalParams: any[]) {
    // Add custom log formatting or logic
    this._writeToFile(message, 'log');
    super.log(message, ...optionalParams);
  }

  error(message: string, ...optionalParams: any[]) {
    // Add custom error handling
    super.error(message, ...optionalParams);
    this._writeToFile(message, 'error');
  }

  warn(message: string, ...optionalParams: any[]) {
    // Add custom warning handling
    super.warn(message, ...optionalParams);
    this._writeToFile(message, 'warn');
  }

  debug(message: string, ...optionalParams: any[]) {
    // Add custom debug handling
    super.debug(message, ...optionalParams);
    this._writeToFile(message, 'debug');
  }

  verbose(message: string, ...optionalParams: any[]) {
    // Add custom verbose handling
    super.verbose(message, ...optionalParams);
    this._writeToFile(message, 'verbose');
  }

  private _writeToFile(message: string, logLevel: LogLevel = 'log') {
    const pidMessage = this.formatPid(process.pid);
    const contextMessage = this.formatContext(this.context);
    const timestampDiff = this.updateAndGetTimestampDiff();
    const formattedLogLevel = logLevel.toUpperCase().padStart(7, ' ');
    const formattedMessage = this.formatMessage(
      logLevel,
      message,
      pidMessage,
      formattedLogLevel,
      contextMessage,
      timestampDiff,
    );
    // check if the log file exists
    if (!fs.existsSync(this._path)) {
      fs.mkdirSync(p.dirname(this._path), { recursive: true });
    }
    // Write the log message to a file
    fs.appendFileSync(this._path, formattedMessage, 'utf8');
  }
}
