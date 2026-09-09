const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkgDir = path.join(root, 'android/app/src/main/java/com/logaan/clarityforge');
fs.mkdirSync(pkgDir, { recursive: true });
for (const file of ['ClarityForgePackage.kt', 'ClarityForgeLocalModule.kt']) {
  fs.copyFileSync(path.join(root, 'native', file), path.join(pkgDir, file));
}

const mainPath = path.join(pkgDir, 'MainApplication.kt');
let main = fs.readFileSync(mainPath, 'utf8');
if (!main.includes('add(ClarityForgePackage())')) {
  const needle = 'PackageList(this).packages.apply {';
  if (!main.includes(needle)) throw new Error('Could not find React Native package list in MainApplication.kt');
  main = main.replace(needle, `${needle}\n          add(ClarityForgePackage())`);
  fs.writeFileSync(mainPath, main);
}

const gradlePath = path.join(root, 'android/app/build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
if (!gradle.includes('org.tensorflow:tensorflow-lite')) {
  const needle = 'dependencies {';
  if (!gradle.includes(needle)) throw new Error('Could not find dependencies block in app/build.gradle');
  gradle = gradle.replace(needle, `${needle}\n    implementation("org.tensorflow:tensorflow-lite:2.17.0")`);
  fs.writeFileSync(gradlePath, gradle);
}

console.log('ClarityForge offline native engine patched into Android project.');
