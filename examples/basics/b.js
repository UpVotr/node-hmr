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

module.exports = moduleBDef;
