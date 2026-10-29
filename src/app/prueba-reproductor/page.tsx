import VideoPlayer from "@/components/VideoPlayer";
import StateMessage from "@/components/series/StateMessage";
import { isValidEpisodeId } from "@/lib/lacartoons-types";

/** Página de prueba del reproductor: /prueba-reproductor?ep=<ID de episodio de LACartoons> */
export default async function TestPlayerPage({ searchParams }: { searchParams: Promise<{ ep?: string }> }) {
    const { ep } = await searchParams;

    return (
        <div className="mx-auto max-w-4xl space-y-4">
            <h1 className="font-display text-2xl text-accent">Prueba del reproductor</h1>

            {isValidEpisodeId(ep) ? (
                <>
                    <p className="font-mono text-xl text-white/70">Episodio: {ep}</p>
                    <VideoPlayer episodeId={ep} />
                </>
            ) : (
                <StateMessage title="Falta el ID del episodio" action={{ href: "/biblioteca", label: "Elegir desde la biblioteca" }}>
                    Abrí esta página con <code>?ep=</code> y el ID de un episodio (formato <code>serie:temporada:episodio</code>).
                </StateMessage>
            )}
        </div>
    );
}
