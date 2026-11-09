import {createRoot} from 'react-dom/client';
import Tour from './app';
import './style.css';
createRoot(document.getElementById('root')!).render(<Tour/>);
new EventSource('/esbuild').addEventListener('change',()=>location.reload());
