import 'buffer';
import { Buffer } from 'buffer';
import process from 'process';
import util from 'util';

globalThis.Buffer = Buffer;
globalThis.process = process;
window.util = util;

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
