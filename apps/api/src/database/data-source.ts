import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment.js';
import { databaseOptions } from './options.js';

const env = validateEnvironment(process.env);
export default new DataSource(databaseOptions(env.DATABASE_URL));
