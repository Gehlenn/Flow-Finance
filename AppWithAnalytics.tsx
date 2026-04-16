import React from 'react';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import App from './App';

export default function AppWithAnalytics() {
  return (
    <>
      <App />
      <VercelAnalytics />
    </>
  );
}