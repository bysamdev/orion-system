import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground p-6">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-black text-primary">404</h1>
        <p className="text-lg text-muted-foreground">Página não encontrada ou inexistente.</p>
        <div>
          <a href="/" className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-sm">
            Voltar para o Início
          </a>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
