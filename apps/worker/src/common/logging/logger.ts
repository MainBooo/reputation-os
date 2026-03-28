export class WorkerLogger {
  static info(message: string, payload?: unknown) {
    console.log(`[worker] ${message}`, payload ?? '')
  }

  static error(message: string, payload?: unknown) {
    console.error(`[worker] ${message}`, payload ?? '')
  }
}
