import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabaseRead } from '@/integrations/supabase/read-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Send, CheckCircle2, Ticket as TicketIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAddTicketRating, useTicketRating } from '@/hooks/useTicketRating';
import { useAuth } from '@/contexts/AuthContext';

export default function Avaliacao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const { data: ticket, isLoading: ticketLoading } = useQuery({
    queryKey: ['ticket-basic', id],
    queryFn: async () => {
      const { data, error } = await supabaseRead
        .from('tickets')
        .select('id, ticket_number, title, status')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: existingRating, isLoading: loadingRating } = useTicketRating(id || '');
  const addRating = useAddTicketRating();
  
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState<number>(0);

  const handleSubmit = async () => {
    // Se não estiver logado, não consegue avaliar no formato atual (RLS exige auth.uid()). 
    // Em uma versão sem login, precisaríamos de uma edge function com service role.
    if (rating === 0 || !user || !id) return;
    await addRating.mutateAsync({
      ticketId: id,
      rating,
      comment,
      userId: user.id
    });
  };

  if (authLoading || ticketLoading || loadingRating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <h2 className="text-2xl font-bold mb-2">Chamado não encontrado</h2>
        <Button variant="outline" onClick={() => navigate('/')}>Voltar ao Início</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/20 p-4">
      <div className="max-w-md w-full space-y-6">
        
        {/* Logo / Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TicketIcon className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Avaliação de Atendimento</h1>
          <p className="text-sm font-medium text-muted-foreground">
            Ticket #{ticket.ticket_number} - {ticket.title}
          </p>
        </div>

        {existingRating ? (
          <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xl shadow-emerald-500/5 overflow-hidden">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-emerald-800 dark:text-emerald-400">Obrigado pela sua avaliação!</h4>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-500 mt-1 mb-4">Seu feedback nos ajuda a melhorar constantemente.</p>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={cn("w-5 h-5", s <= existingRating.rating ? "fill-emerald-500 text-emerald-500" : "text-muted-foreground/30")} />
                  ))}
                </div>
              </div>
              <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/')}>
                Voltar à tela inicial
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/40 shadow-2xl overflow-hidden bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-4 text-center">
              <CardTitle className="text-xl font-bold">Como você avalia a resolução?</CardTitle>
              <CardDescription>Selecione de 1 a 5 estrelas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {(!user) && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs p-3 rounded-lg text-center font-medium">
                  Você precisa estar logado na sua conta para avaliar este atendimento.
                  <Button variant="link" className="text-amber-700 dark:text-amber-400 h-auto p-0 px-1 font-bold" onClick={() => navigate('/auth')}>Fazer Login</Button>
                </div>
              )}

              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={!user}
                    onMouseEnter={() => setHoveredRating(s)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(s)}
                    className="transition-all duration-200 hover:scale-125 focus:outline-none disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <Star 
                      className={cn(
                        "w-12 h-12 transition-colors",
                        (hoveredRating || rating) >= s ? "fill-primary text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "text-muted-foreground/30"
                      )} 
                    />
                  </button>
                ))}
              </div>
              
              {rating > 0 && user && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                  <Textarea
                    placeholder="Conte-nos um pouco mais sobre sua experiência (opcional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[120px] bg-background border-border/40 text-sm rounded-xl resize-none focus-visible:ring-primary/20"
                  />
                  <Button 
                    onClick={handleSubmit} 
                    disabled={addRating.isPending}
                    className="w-full h-12 font-bold gap-2 rounded-xl shadow-lg shadow-primary/20 text-base"
                  >
                    {addRating.isPending ? "Enviando..." : "Enviar Avaliação"}
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
