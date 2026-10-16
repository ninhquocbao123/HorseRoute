export class Logger {
  constructor(private readonly scope: string) {}
  warn(message: string) { console.warn('[' + this.scope + '] ' + message); }
  error(message: string) { console.error('[' + this.scope + '] ' + message); }
}

