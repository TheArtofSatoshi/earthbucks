import { wasm } from "./webbuf_bg.wasm.js";
export * from "./webbuf_bg.js";
import { __wbg_set_wasm } from "./webbuf_bg.js";
__wbg_set_wasm(wasm);
