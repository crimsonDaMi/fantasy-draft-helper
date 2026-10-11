import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

interface PackageInfo {
  name: string;
  version: string;
  license?: string;
}

// Emits THIRD-PARTY-NOTICES.txt with the license text of every npm package
// that ends up in the build (JS, CSS and fonts), since minification strips
// the notices MIT, BSD and OFL require redistributed copies to carry.
export function thirdPartyNotices(): Plugin {
  return {
    name: "third-party-notices",
    apply: "build",
    generateBundle() {
      const packageDirs = new Set<string>();
      for (const id of this.getModuleIds()) {
        const dir = packageDir(id);
        if (dir) packageDirs.add(dir);
      }
      const notices = [...packageDirs]
        .map((dir) => {
          const pkg = JSON.parse(
            readFileSync(path.join(dir, "package.json"), "utf-8"),
          ) as PackageInfo;
          const licenseFile = readdirSync(dir).find((file) =>
            /^(licen[sc]e|copying)(\.|$)/i.test(file),
          );
          if (!licenseFile) {
            this.error(`${pkg.name} has no license file to include`);
          }
          return {
            name: pkg.name,
            text: `${pkg.name}@${pkg.version} (${pkg.license ?? "unknown"})\n\n${readFileSync(path.join(dir, licenseFile), "utf-8").trim()}`,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      this.emitFile({
        type: "asset",
        fileName: "THIRD-PARTY-NOTICES.txt",
        source: `${notices.map((notice) => notice.text).join(`\n\n${"-".repeat(72)}\n\n`)}\n`,
      });
    },
  };
}

// Maps a module id inside node_modules to the root directory of its package.
function packageDir(id: string): string | undefined {
  const marker = `${path.sep}node_modules${path.sep}`;
  const start = id.lastIndexOf(marker);
  if (id.startsWith("\0") || start === -1) return undefined;
  const rest = id.slice(start + marker.length).split(path.sep);
  const nameParts = rest[0].startsWith("@") ? 2 : 1;
  return (
    id.slice(0, start + marker.length) + rest.slice(0, nameParts).join(path.sep)
  );
}
