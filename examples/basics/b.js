const moduleBDef = {
  getPersistentValues() {},

  run() {
    return {
      bar: () => console.log("baz")
    };
  },

  cleanup() {},

  cleanupPersistentValues() {}
};

export default moduleBDef;
