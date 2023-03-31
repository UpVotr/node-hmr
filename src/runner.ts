export class AsyncRunner<P extends Record<string, any>, E> {
  /**
   *
   * @param run Main body of the module. Runs after the file has been updated.
   * @param cleanup Responsible for removing the code that was injected by the run function
   */
  constructor(
    private run: (persistentValues: P, emitUpdate: () => void) => Promise<E>,
    private cleanup: (persistentValues: P, exports: E) => void | Promise<void>
  ) {}

  execute(persistentValues: P, emitUpdate: () => void): Promise<E> {
    return this.run(persistentValues, emitUpdate);
  }

  clean(persistentValues: P, exports: E) {
    return this.cleanup(persistentValues, exports);
  }
}

export class Runner<P extends Record<string, any>, E> {
  /**
   *
   * @param run Main body of the module. Runs after the file has been updated.
   * @param cleanup Responsible for removing the code that was injected by the run function
   */
  constructor(
    private run: (persistentValues: P, emitUpdate: () => void) => E,
    private cleanup: (persistentValues: P, exports: E) => void
  ) {}

  execute(persistentValues: P, emitUpdate: () => void): E {
    return this.run(persistentValues, emitUpdate);
  }

  clean(persistentValues: P, exports: E) {
    return this.cleanup(persistentValues, exports);
  }
}
