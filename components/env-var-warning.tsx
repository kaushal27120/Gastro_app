import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function EnvVarWarning() {
  return (
    <div className="flex gap-4 items-center">
      <Badge variant={"outline"} className="font-normal">
        Wymagane zmienne środowiska Supabase
      </Badge>
      <div className="flex gap-2">
        <Button size="sm" variant={"outline"} disabled>
          Zaloguj się
        </Button>
        <Button size="sm" variant={"default"} disabled>
          Zarejestruj się
        </Button>
      </div>
    </div>
  );
}
