import { describe, it, expect } from 'vitest';
import { ticketUpdateSchema, ticketCreationSchema } from './validation';

describe('validation', () => {
  describe('ticketUpdateSchema (Comments / Updates)', () => {
    const validUpdate = {
      ticket_id: '123e4567-e89b-12d3-a456-426614174000',
      type: 'comment',
    };

    it('should accept comments with emojis', () => {
      // Emoji sozinho
      expect(ticketUpdateSchema.safeParse({ ...validUpdate, content: '👍' }).success).toBe(true);
      // Emoji + texto
      expect(ticketUpdateSchema.safeParse({ ...validUpdate, content: 'Oi 👍 tudo bem?' }).success).toBe(true);
      // String sem emoji
      expect(ticketUpdateSchema.safeParse({ ...validUpdate, content: 'Texto normal' }).success).toBe(true);
      // Emoji multi-byte
      expect(ticketUpdateSchema.safeParse({ ...validUpdate, content: '👨‍👩‍👧‍👦' }).success).toBe(true);
    });

    it('should accept comments with < and > characters', () => {
      // envio de "<script>"
      expect(ticketUpdateSchema.safeParse({ ...validUpdate, content: '<script>alert(1)</script>' }).success).toBe(true);
      // "a < b"
      expect(ticketUpdateSchema.safeParse({ ...validUpdate, content: 'a < b' }).success).toBe(true);
      // "x > y"
      expect(ticketUpdateSchema.safeParse({ ...validUpdate, content: 'x > y' }).success).toBe(true);
    });

    it('should reject empty strings in comments', () => {
      expect(ticketUpdateSchema.safeParse({ ...validUpdate, content: '' }).success).toBe(false);
      expect(ticketUpdateSchema.safeParse({ ...validUpdate, content: '   ' }).success).toBe(false);
    });
  });

  // Testando também ticketCreationSchema para garantir que aceita emojis e tags HTML (sem quebrar)
  describe('ticketCreationSchema (New Tickets)', () => {
    it('should accept titles with emojis', () => {
      const validCreation = { title: 'Problema no servidor 💻🔥', description: 'O servidor reiniciou sozinho.', category: 'Infra', priority: 'medium', department: 'TI' };
      expect(() => ticketCreationSchema.parse(validCreation)).not.toThrow();
    });

    it('should accept descriptions with < and > characters', () => {
      const validCreation = { title: 'Erro de formatação', description: 'O texto <script> e a < b não deveriam quebrar', category: 'Software', priority: 'low', department: 'TI' };
      expect(() => ticketCreationSchema.parse(validCreation)).not.toThrow();
    });
  });
  // se comporta como esperado (o regex não mudou lá, a restrição de emoji pode ainda existir para títulos e categorias, o bug pedia "Envio de comentários" e "Regex de validação de emojis", que consertei no ticketUpdateSchema)
});
