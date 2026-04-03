import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Login from '../../components/Login';

const loginMocks = vi.hoisted(() => ({
  signInWithPopup: vi.fn(),
  isFirebaseConfigured: true,
}));

vi.mock('../../services/firebase', () => ({
  auth: {},
  googleProvider: {},
  signInWithPopup: loginMocks.signInWithPopup,
  get isFirebaseConfigured() {
    return loginMocks.isFirebaseConfigured;
  },
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

describe('Login accessibility flow', () => {
  it('informa erro amigavel quando Firebase nao esta configurado', () => {
    loginMocks.isFirebaseConfigured = false;

    render(<Login onLogin={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('E-mail de acesso'), { target: { value: 'teste@flow.dev' } });
    fireEvent.change(screen.getByLabelText('Senha de acesso'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Acessar Conta/i }));

    expect(screen.getByRole('alert').textContent).toContain('Autenticacao Firebase indisponivel neste ambiente');

    loginMocks.isFirebaseConfigured = true;
  });

  it('renders login fields with accessible labels', () => {
    render(<Login onLogin={vi.fn()} />);

    expect(screen.getByLabelText('E-mail de acesso')).toBeTruthy();
    expect(screen.getByLabelText('Senha de acesso')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Acessar Conta/i })).toBeTruthy();
  });

  it('renders sign-up labels after navigating to cadastro', () => {
    render(<Login onLogin={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Cadastre-se/i }));

    expect(screen.getByLabelText('Nome completo')).toBeTruthy();
    expect(screen.getByLabelText('E-mail para cadastro')).toBeTruthy();
    expect(screen.getByLabelText('Senha para cadastro')).toBeTruthy();
  });

  it('exposes recovery label and alert semantics for local validation errors', () => {
    render(<Login onLogin={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Cadastre-se/i }));
    fireEvent.change(screen.getByLabelText('Nome completo'), { target: { value: 'Teste User' } });
    fireEvent.change(screen.getByLabelText('E-mail para cadastro'), { target: { value: 'teste@flow.dev' } });
    fireEvent.change(screen.getByLabelText('Senha para cadastro'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar meu Acesso/i }));

    expect(screen.getByRole('alert').textContent).toContain('A senha precisa de no mínimo 6 caracteres.');

    fireEvent.click(screen.getByRole('button', { name: /Voltar/i }));
    fireEvent.click(screen.getByRole('button', { name: /Esqueci a senha/i }));

    expect(screen.getByLabelText('E-mail para recuperar senha')).toBeTruthy();
  });
});