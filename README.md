# Project Phantasm (Phantasm)

Minecraft Bedrock Edition addon project that adds may contents, new boss, new weapons, new mechanics, new structure, changes how you explore minecraft without making original minecraft element obsolete.

## Setup

```bash
bun install
```
or
```bash
npm install
```

and also for Regolith filters :

```bash
rgl install
```

## Development

```bash
rgl run
```

This builds and exports the addon to your Minecraft development folder when local export paths are configured.

```bash
rgl watch
```

This watches your changes in real time, builds and exports the addon to your Minecraft development folder when local export paths are configured.

## Apply Regolith Filters

```bash
rgl apply default
```

Apply your confirmed changes before committing into GitHub, or Package them into a release build. Ensure that your changes to be applied in packs/ 

## Project Structure

```text
packs/
  BP/              # Behavior pack
  RP/              # Resource pack
data/
  scripts/         # TypeScript source files
config.json        # Regolith configuration
package.json       # Script API dependencies
```