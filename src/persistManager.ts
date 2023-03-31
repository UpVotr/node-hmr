export class PersistManager<P extends Record<string, any>> {
  /**
   *
   * @param generatePersistentValues This code is only run on the first require, or if
   * {@link HotModule.updatePersistentValues updatePersistentValues} is true.
   * @param cleanupPersistentValues Responsible for hadnling any cleanup that is required for updating
   * persistent values when {@link updatePersistentValues updatePersistentValues}
   * is true.
   */
  constructor(
    private generatePersistentValues: () => Promise<P> | P,
    private cleanupPersistentValues: (
      persistentValues: P
    ) => Promise<void> | void
  ) {}

  generate() {
    return this.generatePersistentValues();
  }

  cleanup(p: P) {
    return this.cleanupPersistentValues(p);
  }
}
