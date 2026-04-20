import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { chromium, type Page, type BrowserContext, type Locator, type FileChooser } from "playwright";
import express, { Router } from "express";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import queue from "express-queue";
import multer from "multer";

try {
  loadEnvFile();
} catch (error) {
  console.warn("No .env file found, relying on environment variables.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const rootRaiz = path.join(__dirname, "../../");

export { chromium, path, express, Router, helmet, morgan, compression, queue, multer };
export type { Page, BrowserContext, Locator, FileChooser };