import { loadEnvFile } from 'node:process';
import { chromium, type Page, type BrowserContext } from "playwright";
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import express, { Router } from "express";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import type { PeticionIA } from "../server/interfaces.js"
import queue from "express-queue";
loadEnvFile();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootRaiz = path.join(__dirname, "../../")


export type { Page, BrowserContext, PeticionIA }

export { chromium, rootRaiz, path, express, helmet, morgan, compression, Router, queue }; 