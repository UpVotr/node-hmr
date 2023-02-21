const fs = require("fs");
const path = require("path");

const root = path.resolve(path.dirname(__filename), "../");

const buildDir = path.join(root, "build");

if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

const esmDir = path.join(buildDir, "esm");
const cjsDir = path.join(buildDir, "commonjs");

if (!fs.existsSync(esmDir)) {
  fs.mkdirSync(esmDir);
}

if (!fs.existsSync(cjsDir)) {
  fs.mkdirSync(cjsDir);
}

const esmPkgJson = path.join(esmDir, "package.json");
const cjsPkgJson = path.join(cjsDir, "package.json");

if (!fs.existsSync(esmPkgJson) || require(esmPkgJson).type !== "module") {
  fs.writeFileSync(
    esmPkgJson,
    JSON.stringify({
      type: "module"
    })
  );
}

if (!fs.existsSync(cjsPkgJson) || require(cjsPkgJson).type !== "commonjs") {
  fs.writeFileSync(
    cjsPkgJson,
    JSON.stringify({
      type: "commonjs"
    })
  );
}
