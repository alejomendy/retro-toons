/**
 * Se ejecuta una vez al iniciar el servidor de Next.
 *
 * Node corta cada intento de conexión a los 250 ms cuando prueba IPv6/IPv4
 * ("happy eyeballs"). Con conexiones lentas (TMDB, Wikipedia) eso hace
 * fallar los fetch con ETIMEDOUT aunque la API funcione. Lo subimos a 2 s.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const net = await import("node:net");
    net.setDefaultAutoSelectFamilyAttemptTimeout(2000);
  }
}
