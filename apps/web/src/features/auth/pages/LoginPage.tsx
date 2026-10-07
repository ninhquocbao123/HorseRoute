import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Navigate } from 'react-router-dom';
import { auth } from '../../../lib/firebase';
import { useAuth } from '../hooks/useAuth';

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Tối thiểu 6 ký tự'),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  if (user) return <Navigate to="/" replace />;

  const run = (mode: 'login' | 'register') => handleSubmit(async ({ email, password }) => {
    setError('');
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setError(e.message);
    }
  });

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>Đăng nhập</h2>
        <form onSubmit={run('login')}>
          <input placeholder="Email" {...register('email')} />
          {errors.email && <div className="error">{errors.email.message}</div>}
          <input type="password" placeholder="Mật khẩu" {...register('password')} />
          {errors.password && <div className="error">{errors.password.message}</div>}
          {error && <div className="error">{error}</div>}
          <button disabled={isSubmitting} type="submit">Đăng nhập</button>{' '}
          <button disabled={isSubmitting} type="button" onClick={run('register')}>Đăng ký</button>
        </form>
      </div>
    </div>
  );
}
