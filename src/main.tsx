import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ConfirmProvider } from './context/ConfirmContext';
import { AuthProvider } from './context/AuthContext';
import { AppStateProvider } from './context/AppStateContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Carregando AgroControl..." fallbackDescription="O sistema está inicializando. Se esta mensagem persistir, clique em recarregar.">
      <AuthProvider>
        <ConfirmProvider>
          <AppStateProvider>
            <App />
          </AppStateProvider>
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);

