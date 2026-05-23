#!/usr/bin/env node
import { createHomebridgeCli } from "../dist/src/cli.js";

await createHomebridgeCli().serve();
