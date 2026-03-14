import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAddTicketRating, useTicketRating } from '@/hooks/useTicketRating';
import { useAuth } from '@/contexts/AuthContext';

interface SatisfactionSurveyProps {
  ticketId: string;
}

export const SatisfactionSurvey: React.FC<SatisfactionSurveyProps> = ({ ticketId }) => {
  const { user } = useAuth();
  const { data: existingRating, isLoading: loadingRating } = useTicketRating(ticketId);
  const addRating = useAddTicketRating();
  
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState<number>(0);

  const handleSubmit = async () => {
    if (rating === 0 || !user) return;
    await addRating.mutateAsync({
      ticketId,
      rating,
      comment,
      userId: user.id
    });
  };

  if (loadingRating) return null;
  if (existingRating) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-none overflow-hidden">
        <CardContent className="p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-emerald-800 dark:text-emerald-400">Obrigado pela sua avaliação!</h4>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={cn("w-3 h-3", s <= existingRating.rating ? "fill-emerald-500 text-emerald-500" : "text-muted-foreground/30")} />
              ))}
            </div>
            {existingRating.comment && <p className="text-[10px] text-muted-foreground mt-1 italic">"{existingRating.comment}"</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-xl shadow-primary/5 overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-black tracking-tight">Como foi seu atendimento?</CardTitle>
        <CardDescription className="text-xs">Sua opinião é fundamental para melhorarmos nossos serviços.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center gap-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHoveredRating(s)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setRating(s)}
              className="transition-all duration-200 hover:scale-125 focus:outline-none"
            >
              <Star 
                className={cn(
                  "w-10 h-10 transition-colors",
                  (hoveredRating || rating) >= s ? "fill-primary text-primary" : "text-muted-foreground/30"
                )} 
              />
            </button>
          ))}
        </div>
        
        {rating > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <Textarea
              placeholder="Conte-nos um pouco mais sobre sua experiência (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[100px] bg-background border-border/40 text-sm rounded-xl resize-none"
            />
            <Button 
              onClick={handleSubmit} 
              disabled={addRating.isPending}
              className="w-full h-11 font-bold gap-2 rounded-xl shadow-lg shadow-primary/20"
            >
              {addRating.isPending ? "Enviando..." : "Enviar Avaliação"}
              <Send className="w-4 h-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
