import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifierPath = path.join(projectRoot, "scripts", "verify-git-safety.mjs");
const hookInstallerPath = path.join(projectRoot, "scripts", "install-git-hooks.mjs");
const productionConfig = JSON.parse(readFileSync(path.join(projectRoot, "config", "git-safety.json"), "utf8"));
const productionGitignore = readFileSync(path.join(projectRoot, ".gitignore"), "utf8");

function writeFixtureConfig(root, overrides = {}) {
  const config = {
    ...productionConfig,
    ...overrides,
  };
  const configPath = path.join(root, ".git", "git-safety.json");
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return configPath;
}

function initFixture(t, { gitignore = "" } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "personal-sites-git-safety-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  writeFileSync(path.join(root, ".gitignore"), gitignore);
  writeFileSync(path.join(root, "README.md"), "# Public repository\n");
  execFileSync("git", ["add", ".gitignore", "README.md"], { cwd: root });
  return root;
}

function runVerifier(root, configPath, extraArguments = []) {
  return spawnSync(process.execPath, [
    verifierPath,
    "--repo",
    root,
    "--config",
    configPath,
    ...extraArguments,
  ], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

function commitFixture(root, message) {
  execFileSync("git", [
    "-c",
    "user.name=Git Safety Test",
    "-c",
    "user.email=git-safety@example.invalid",
    "commit",
    "--quiet",
    "-m",
    message,
  ], { cwd: root });
}

test("git safety accepts a public-only repository with private paths ignored", (t) => {
  const root = initFixture(t, { gitignore: productionGitignore });
  const configPath = writeFixtureConfig(root);
  const result = runVerifier(root, configPath);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.verified, true);
  assert.equal(report.violations, 0);
});

test("git safety rejects a private raw file that was force-added to Git", (t) => {
  const root = initFixture(t, { gitignore: productionGitignore });
  const configPath = writeFixtureConfig(root);
  mkdirSync(path.join(root, "data", "private"), { recursive: true });
  writeFileSync(path.join(root, "data", "private", "raw.json"), "private evidence\n");
  execFileSync("git", ["add", "--force", "data/private/raw.json"], { cwd: root });

  const result = runVerifier(root, configPath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /data\/private\/raw\.json/);
  assert.match(result.stderr, /禁止进入 Git/);
});

test("git safety rejects an oversized untracked file before it is staged", (t) => {
  const root = initFixture(t, { gitignore: productionGitignore });
  const configPath = writeFixtureConfig(root, {
    max_regular_git_file_bytes: 32,
    github_hard_limit_bytes: 64,
  });
  mkdirSync(path.join(root, "public"), { recursive: true });
  writeFileSync(path.join(root, "public", "large.bin"), Buffer.alloc(33));

  const result = runVerifier(root, configPath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /public\/large\.bin/);
  assert.match(result.stderr, /超过常规 Git 上限/);
});

test("git safety rejects a repository missing a required private ignore rule", (t) => {
  const root = initFixture(t, {
    gitignore: productionGitignore.replace("/knowledge/private/\n", ""),
  });
  const configPath = writeFixtureConfig(root);

  const result = runVerifier(root, configPath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /knowledge\/private\/\.git-safety-probe/);
  assert.match(result.stderr, /未被 \.gitignore 覆盖/);
});

test("git safety rejects a generated directory force-added below a future subproject", (t) => {
  const root = initFixture(t, { gitignore: productionGitignore });
  const configPath = writeFixtureConfig(root);
  mkdirSync(path.join(root, "apps", "web", "node_modules"), { recursive: true });
  writeFileSync(path.join(root, "apps", "web", "node_modules", "package.js"), "generated\n");
  execFileSync("git", ["add", "--force", "apps/web/node_modules/package.js"], { cwd: root });

  const result = runVerifier(root, configPath);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /apps\/web\/node_modules\/package\.js/);
  assert.match(result.stderr, /禁止进入 Git/);
});

test("git safety rejects private Raw that was added and deleted earlier in reachable history", (t) => {
  const root = initFixture(t, { gitignore: productionGitignore });
  const configPath = writeFixtureConfig(root);
  mkdirSync(path.join(root, "data", "private"), { recursive: true });
  writeFileSync(path.join(root, "data", "private", "raw.json"), "private evidence\n");
  execFileSync("git", ["add", "--force", "data/private/raw.json"], { cwd: root });
  commitFixture(root, "add private evidence");
  rmSync(path.join(root, "data", "private", "raw.json"));
  execFileSync("git", ["add", "--update"], { cwd: root });
  commitFixture(root, "remove private evidence");

  const result = runVerifier(root, configPath, ["--range", "HEAD"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /data\/private\/raw\.json/);
  assert.match(result.stderr, /历史对象禁止进入 Git/);
});

test("hook installer activates the repository pre-push guard for a fresh clone", (t) => {
  const root = initFixture(t, { gitignore: productionGitignore });
  mkdirSync(path.join(root, ".githooks"), { recursive: true });
  const hookPath = path.join(root, ".githooks", "pre-push");
  writeFileSync(hookPath, "#!/bin/sh\nprintf 'executed\\n' > .git/pre-push-ran\n");

  const result = spawnSync(process.execPath, [hookInstallerPath, "--repo", root], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const configuredHookPath = execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  assert.equal(configuredHookPath, ".githooks");

  const hookResult = spawnSync(hookPath, [], { cwd: root, encoding: "utf8" });
  assert.equal(hookResult.status, 0, hookResult.error?.message ?? hookResult.stderr);
  assert.equal(readFileSync(path.join(root, ".git", "pre-push-ran"), "utf8"), "executed\n");
});
