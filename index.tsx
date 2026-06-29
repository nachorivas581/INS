import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  StyleSheet, Text, View, ActivityIndicator, TextInput, StatusBar,
  Dimensions, PanResponder, FlatList, TouchableOpacity, ScrollView,
  Animated, Easing, Image, Platform, UIManager, LayoutAnimation,
  RefreshControl, Modal, Alert,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useVideoPlayer, VideoView } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: W, height: H } = Dimensions.get('window');

/* ═══════════════════════════════════════════════════════════
   CONFIGURACIÓN
═══════════════════════════════════════════════════════════ */
const TMDB_API_KEY           = 'cd567a4b1c99d7e5acebd57afda5a196';
const GOOGLE_DRIVE_API_KEY   = 'AIzaSyAsQYU7JBhGalFd8woneHClsm5FJdOTHF4';
const DRIVE_FOLDER_PELICULAS = '10G68TcC3ywAUfyXz82QntyCRwb-2yKq2';
const DRIVE_FOLDER_SERIES    = '1J4v2HMFaKy2ZKg20QU7kmH7k7rRV13Zh';
const M3U_URL                = 'https://naphdev.online/list.m3u';

const ACCENT_COLORS: Record<string, string> = {
  red:    '#E50914',
  violet: '#6C63FF',
  blue:   '#3B82F6',
  green:  '#10B981',
};

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════ */
const T = {
  color: {
    bg:              '#07070F',
    surface:         '#0E0E1C',
    surfaceElevated: '#151526',
    border:          'rgba(255,255,255,0.07)',
    primary:         '#E50914',
    primaryDim:      'rgba(229,9,20,0.15)',
    gold:            '#F5A623',
    textPrimary:     '#FFFFFF',
    textSecondary:   'rgba(255,255,255,0.60)',
    textMuted:       'rgba(255,255,255,0.32)',
    success:         '#21D07A',
    live:            '#FF2D55',
  },
  font: {
    xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, xxl: 30, hero: 38,
    regular: '400' as const, medium: '500' as const, semibold: '600' as const,
    bold: '700' as const, extrabold: '800' as const, black: '900' as const,
  },
  space: { xs: 4, sm: 8, md: 14, lg: 20, xl: 28, xxl: 40 },
  radius: { sm: 6, md: 10, lg: 16, xl: 22, full: 999 },
};

/* ═══════════════════════════════════════════════════════════
   ESCALA Y DISPOSITIVO
═══════════════════════════════════════════════════════════ */
const IS_TV     = Platform.isTV || W >= 960;
const IS_TABLET = !IS_TV && W >= 600;
const IS_SMALL  = !IS_TV && !IS_TABLET && W <= 480;
const SCALE     = IS_TV ? 1.6 : IS_TABLET ? 1.25 : IS_SMALL ? 0.88 : 1;
const s         = (n: number) => Math.round(n * SCALE);

const LIVE_PLAYER_H  = IS_TV ? Math.round(W * 0.38) : IS_TABLET ? 240 : IS_SMALL ? 160 : 196;
const VOD_PLAYER_H   = IS_TV ? Math.round(W * 0.38) : IS_TABLET ? 240 : IS_SMALL ? 175 : 210;
const MEDIA_COLS     = IS_TV ? 4 : IS_TABLET ? 3 : 2;

/* ═══════════════════════════════════════════════════════════
   TIPOS
═══════════════════════════════════════════════════════════ */
interface Canal {
  id: string;
  numero: number;
  name: string;
  url: string;
  logo: string;
  category: string;
  nowPlaying?: string;
  needsWebView?: boolean;
}

interface MediaItem {
  id: string;
  title: string;
  poster: string;
  backdrop?: string;
  genre?: string;
  year?: number;
  rating?: string;
  seasons?: number;
  overview?: string;
  type?: 'movie' | 'tv';
  custom?: boolean;
  streamUrl?: string;
}

/* ═══════════════════════════════════════════════════════════
   CANALES MANUALES
═══════════════════════════════════════════════════════════ */
const CANALES_MANUALES: Canal[] = [
  { id: 'man-1',  numero: 1,  name: 'DSports',        url: 'https://streamtpday1.xyz/global1.php?stream=dsports',      logo: 'https://upload.wikimedia.org/wikipedia/commons/d/df/DirecTV_Sports_logo.png', category: 'Deportes', nowPlaying: 'Fútbol: Copa Libertadores' },
  { id: 'man-2',  numero: 2,  name: 'DSports 2',      url: 'https://streamtpday1.xyz/global1.php?stream=dsports2',     logo: '', category: 'Deportes', nowPlaying: 'Tenis: Wimbledon' },
  { id: 'man-3',  numero: 3,  name: 'DSports +',      url: 'https://streamtpday1.xyz/global1.php?stream=dsportsplus',  logo: '', category: 'Deportes', nowPlaying: 'Motociclismo: MotoGP' },
  { id: 'man-4',  numero: 4,  name: 'TyC Sports',     url: 'https://streamtpday1.xyz/global1.php?stream=tyc',          logo: '', category: 'Deportes', nowPlaying: 'Noticias Deportivas' },
  { id: 'man-5',  numero: 5,  name: 'TNT Sports',     url: 'https://streamtpday1.xyz/global1.php?stream=tntsports',    logo: '', category: 'Deportes', nowPlaying: 'Fútbol Argentino' },
  { id: 'man-6',  numero: 6,  name: 'ESPN Premium',   url: 'https://streamtpday1.xyz/global1.php?stream=espnpremium',  logo: '', category: 'Deportes', nowPlaying: 'Fútbol Europeo' },
  { id: 'man-7',  numero: 7,  name: 'ESPN 1',         url: 'https://streamtpday1.xyz/global1.php?stream=espn',         logo: '', category: 'Deportes', nowPlaying: 'Baloncesto NBA' },
  { id: 'man-8',  numero: 8,  name: 'ESPN 2',         url: 'https://streamtpday1.xyz/global1.php?stream=espn2',        logo: '', category: 'Deportes', nowPlaying: 'Béisbol MLB' },
  { id: 'man-9',  numero: 9,  name: 'ESPN 3',         url: 'https://streamtpday1.xyz/global1.php?stream=espn3',        logo: '', category: 'Deportes', nowPlaying: 'Análisis Deportivo' },
  { id: 'man-10', numero: 10, name: 'ESPN 4',         url: 'https://streamtpday1.xyz/global1.php?stream=espn4',        logo: '', category: 'Deportes', nowPlaying: 'Rugby' },
  { id: 'man-11', numero: 11, name: 'ESPN 5',         url: 'https://streamtpday1.xyz/global1.php?stream=espn5',        logo: '', category: 'Deportes', nowPlaying: 'Hockey' },
  { id: 'man-12', numero: 12, name: 'Claro Sports',   url: 'https://pluto.tv/latam/live-tv/6320d80a66666000086712d7',  logo: '', category: 'Deportes', nowPlaying: 'Deportes en Vivo' },
  { id: 'man-13', numero: 13, name: 'TNT Series',     url: 'https://regionales.saohgdasregions.fun/stream.php?canal=tntseries&target=2', logo: '', category: 'Entretenimiento', nowPlaying: 'Series 24/7', needsWebView: true },
  { id: 'man-14', numero: 14, name: 'Disney Channel', url: 'https://regionales.saohgdasregions.fun/stream.php?canal=disney&target=2',    logo: '', category: 'Entretenimiento', nowPlaying: 'Disney 24/7', needsWebView: true },
  { id: 'man-15', numero: 15, name: 'TNT',            url: 'https://regionales.saohgdasregions.fun/stream.php?canal=tnt&target=2',       logo: '', category: 'Entretenimiento', nowPlaying: 'TNT 24/7',    needsWebView: true },
  { id: 'man-16', numero: 16, name: 'Warner Channel', url: 'https://regionales.saohgdasregions.fun/stream.php?canal=warner&target=2',    logo: '', category: 'Entretenimiento', nowPlaying: 'Warner 24/7', needsWebView: true },
  { id: 'man-17', numero: 17, name: 'FX',             url: 'https://regionales.saohgdasregions.fun/stream.php?canal=fx&target=2',        logo: '', category: 'Entretenimiento', nowPlaying: 'FX 24/7',     needsWebView: true },
  { id: 'man-18', numero: 18, name: 'Comedy Central', url: 'https://regionales.saohgdasregions.fun/stream.php?canal=comedy&target=2',    logo: '', category: 'Entretenimiento', nowPlaying: 'Comedy 24/7', needsWebView: true },
];

/* ═══════════════════════════════════════════════════════════
   FALLBACKS TMDB
═══════════════════════════════════════════════════════════ */
const MOVIES_FALLBACK: MediaItem[] = [
  { id: 'mov1', title: 'Inception',    poster: 'https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', genre: 'Ciencia ficción', year: 2010, rating: '8.8', overview: 'Un ladrón especializado en el robo de secretos corporativos...', type: 'movie' },
  { id: 'mov2', title: 'Interstellar', poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', genre: 'Ciencia ficción', year: 2014, rating: '8.6', type: 'movie' },
];
const SERIES_FALLBACK: MediaItem[] = [
  { id: 'ser1', title: 'Breaking Bad',    poster: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', genre: 'Drama',          seasons: 5, rating: '9.5', overview: 'Un profesor de química con cáncer terminal...', type: 'tv' },
  { id: 'ser2', title: 'Stranger Things', poster: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg', genre: 'Ciencia ficción', seasons: 4, rating: '8.7', type: 'tv' },
];

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
function esUrlManifiesto(v: string) { return /(\.m3u8|\.mpd)(\?|#|$)/i.test(v); }
function extraerManifiesto(txt: string): string | null {
  const m = (txt || '').trim().match(/https?:\/\/[^\s"'<>]+?\.(?:m3u8|mpd)(?:\?[^\s"'<>]*)?/i);
  return m ? m[0] : null;
}
function cacheBust(url: string) { return `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`; }

/* ═══════════════════════════════════════════════════════════
   GOOGLE DRIVE HELPERS
═══════════════════════════════════════════════════════════ */
function limpiarNombreArchivo(nombre: string): { titulo: string; anio?: number } {
  let n = nombre.replace(/\.(mp4|mkv|avi|mov|webm|m4v)$/i, '');
  const matchAnio = n.match(/\b(19|20)\d{2}\b/);
  const anio = matchAnio ? parseInt(matchAnio[0], 10) : undefined;
  n = n
    .replace(/[._]/g, ' ')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\b(1080p|720p|2160p|4k|hdr|web[-]?dl|bluray|brrip|hdtv|x264|x265|hevc|aac|dual|latino|castellano|subtitulado|temporada|cap(itulo)?s?)\b/gi, ' ')
    .replace(/\bS\d{1,2}(E\d{1,2})?\b/gi, ' ')
    .replace(/\s{2,}/g, ' ').trim();
  return { titulo: n, anio };
}

async function buscarMetadataTMDB(titulo: string, anio: number | undefined, tipo: 'movie' | 'tv'): Promise<any | null> {
  try {
    const ep  = tipo === 'movie' ? 'search/movie' : 'search/tv';
    const yr  = anio ? `&year=${anio}` : '';
    const res = await fetch(`https://api.themoviedb.org/3/${ep}?api_key=${TMDB_API_KEY}&language=es&query=${encodeURIComponent(titulo)}${yr}`);
    const d   = await res.json();
    return d.results?.length ? d.results[0] : null;
  } catch { return null; }
}

async function listarArchivosDrive(folderId: string): Promise<any[]> {
  let archivos: any[] = [], pageToken: string | undefined;
  do {
    const tp  = pageToken ? `&pageToken=${pageToken}` : '';
    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=nextPageToken,files(id,name,mimeType,size,modifiedTime)&pageSize=1000&key=${GOOGLE_DRIVE_API_KEY}${tp}`;
    const res = await fetch(url);
    const d   = await res.json();
    if (d.files) archivos = archivos.concat(d.files);
    pageToken = d.nextPageToken;
  } while (pageToken);
  return archivos.filter(f => f.mimeType?.startsWith('video/'));
}

async function construirItemDrive(archivo: any, tipo: 'movie' | 'tv'): Promise<MediaItem> {
  const { titulo, anio } = limpiarNombreArchivo(archivo.name);
  const streamUrl = `https://www.googleapis.com/drive/v3/files/${archivo.id}?alt=media&key=${GOOGLE_DRIVE_API_KEY}`;
  const meta = await buscarMetadataTMDB(titulo, anio, tipo);
  if (meta) {
    return {
      id: `drive-${archivo.id}`,
      title: tipo === 'movie' ? meta.title : meta.name,
      poster: meta.poster_path ? `https://image.tmdb.org/t/p/w500${meta.poster_path}` : 'https://via.placeholder.com/500x750.png?text=Sin+Imagen',
      backdrop: meta.backdrop_path ? `https://image.tmdb.org/t/p/w780${meta.backdrop_path}` : undefined,
      year: tipo === 'movie' ? (meta.release_date ? new Date(meta.release_date).getFullYear() : anio) : (meta.first_air_date ? new Date(meta.first_air_date).getFullYear() : anio),
      rating: meta.vote_average ? meta.vote_average.toFixed(1) : '0.0',
      seasons: tipo === 'tv' ? meta.number_of_seasons : undefined,
      overview: meta.overview || 'Sin descripción disponible.',
      type: tipo, streamUrl,
    };
  }
  return {
    id: `drive-${archivo.id}`, title: titulo || archivo.name,
    poster: 'https://via.placeholder.com/500x750.png?text=Sin+Imagen',
    year: anio, rating: '0.0', overview: 'Sin descripción disponible.',
    type: tipo, streamUrl, custom: true,
  };
}

async function cargarCarpetaDrive(folderId: string, tipo: 'movie' | 'tv', cacheKey: string): Promise<MediaItem[]> {
  try {
    const raw   = await AsyncStorage.getItem(cacheKey);
    const cache = raw ? JSON.parse(raw) : {};
    const archivos = await listarArchivosDrive(folderId);
    const items: MediaItem[] = [];
    for (const a of archivos) {
      const ce = cache[a.id];
      if (ce && ce.modifiedTime === a.modifiedTime) { items.push(ce.item); }
      else { const item = await construirItemDrive(a, tipo); cache[a.id] = { modifiedTime: a.modifiedTime, item }; items.push(item); }
    }
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
    return items;
  } catch (e) { console.warn('Drive error:', e); return []; }
}

/* ═══════════════════════════════════════════════════════════
   REPRODUCTOR NATIVO (genérico, sin estado de canal)
═══════════════════════════════════════════════════════════ */
const ReproductorNativo = memo(({
  url, contentFit, isLive = false, onError, onStall,
}: {
  url: string; contentFit: 'contain' | 'fill'; isLive?: boolean; onError?: () => void; onStall?: () => void;
}) => {
  const [activeUrl, setActiveUrl] = useState(() => cacheBust(url));
  const player = useVideoPlayer(activeUrl, p => {
    p.loop = false;
    if (isLive) try { (p as any).seekToLiveEdge?.(); } catch (_) {}
    p.play();
  });

  const stallTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPos      = useRef(0);
  const stallCount   = useRef(0);
  const replaceCount = useRef(0);
  const CHECK = 9000, MIN_DELTA = 0.8, STALL_THRESH = 3, MAX_REPLACE = 3;

  useEffect(() => {
    setActiveUrl(cacheBust(url));
    replaceCount.current = 0; stallCount.current = 0; lastPos.current = 0;
  }, [url]);

  useEffect(() => {
    if (!player) return;
    if (stallTimer.current) clearInterval(stallTimer.current);
    stallTimer.current = setInterval(() => {
      try {
        const pos = player.currentTime ?? 0;
        if (Math.abs(pos - lastPos.current) < MIN_DELTA) {
          stallCount.current++;
          if (stallCount.current >= STALL_THRESH) {
            stallCount.current = 0;
            if (replaceCount.current < MAX_REPLACE) {
              replaceCount.current++;
              try { player.replace(cacheBust(url)); setTimeout(() => { try { if (isLive) (player as any).seekToLiveEdge?.(); player.play(); } catch (_) {} }, 500); } catch { try { player.play(); } catch (_) {} }
            } else {
              if (stallTimer.current) clearInterval(stallTimer.current);
              onStall?.(); onError?.();
            }
          }
        } else { stallCount.current = 0; replaceCount.current = 0; }
        lastPos.current = pos;
      } catch (_) {}
    }, CHECK);
    return () => { if (stallTimer.current) clearInterval(stallTimer.current); };
  }, [player, url]);

  useEffect(() => {
    if (!player) return;
    const s1 = player.addListener('statusChange', (p: any) => {
      if (p?.error) { if (stallTimer.current) clearInterval(stallTimer.current); onError?.(); return; }
      if ((p?.status ?? p) === 'idle') { try { player.replace(cacheBust(url)); setTimeout(() => { try { player.play(); } catch (_) {} }, 400); } catch (_) {} }
    });
    const s2 = player.addListener('playingChange', (p: any) => {
      if (!(p?.isPlaying ?? p)) setTimeout(() => { try { if (!player.playing) player.play(); } catch (_) {} }, 6000);
    });
    return () => { s1.remove(); s2.remove(); };
  }, [player, url, onError]);

  return <VideoView style={StyleSheet.absoluteFill} player={player} contentFit={contentFit} nativeControls={false} />;
});

/* ═══════════════════════════════════════════════════════════
   JS WEBVIEW INJECTION
═══════════════════════════════════════════════════════════ */
const INJECT_BEFORE = `(function(){if(window.__NX__)return;window.__NX__=true;function post(u){try{if(typeof u!=='string'||u.length<12)return;if(!/(\.m3u8|\.mpd)(\\?|#|$)/i.test(u))return;window.ReactNativeWebView.postMessage('FOUND_MANIFEST:'+u);}catch(e){}}try{var oO=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{post(u);}catch(e){}return oO.apply(this,arguments)};}catch(e){}try{var oF=window.fetch;if(oF){window.fetch=function(i,n){try{var u=typeof i==='string'?i:(i&&i.url?i.url:'');post(u);}catch(e){}return oF.apply(this,arguments).then(function(r){try{if(r&&r.url)post(r.url);}catch(e){}return r;});};}}catch(e){}try{var ob=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeName==='VIDEO'){post(n.src||n.currentSrc||'');n.addEventListener('loadedmetadata',function(){post(n.currentSrc||'');});}if(n.nodeName==='IFRAME'){window.ReactNativeWebView.postMessage('IFRAME_SRC:'+n.src);}if(n.nodeName==='SOURCE'){post(n.src||'');}});});});ob.observe(document.documentElement||document.body,{childList:true,subtree:true});}catch(e){}})();true;`;

const INJECT_AFTER = `(function(){function post(u){try{if(typeof u!=='string'||u.length<12)return;if(!/(\.m3u8|\.mpd)(\\?|#|$)/i.test(u))return;window.ReactNativeWebView.postMessage('FOUND_MANIFEST:'+u);}catch(e){}}function scan(){try{var h=document.documentElement.innerHTML||'';var m=h.match(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/gi);if(m)m.forEach(post);Array.from(document.getElementsByTagName('video')).forEach(function(v){try{v.play();}catch(e){}post(v.src||v.currentSrc||'');});var b=document.querySelectorAll('.play-button,.vjs-big-play-button,.jw-icon-playback,#play,.play-btn,[data-action="play"]');b.forEach(function(x){try{x.click();}catch(e){}});Array.from(document.getElementsByTagName('source')).forEach(function(s){post(s.getAttribute('src')||'');});}catch(e){}}scan();var iv=setInterval(scan,2000);setTimeout(function(){clearInterval(iv);window.ReactNativeWebView.postMessage('MANIFEST_TIMEOUT');},24000);})();true;`;

/* ═══════════════════════════════════════════════════════════
   SHIMMER
═══════════════════════════════════════════════════════════ */
const Shimmer = ({ w, h, style }: { w: number; h: number; style?: any }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, []);
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [-w, w] });
  return (
    <View style={[{ width: w, height: h, backgroundColor: T.color.surface, borderRadius: T.radius.md, overflow: 'hidden' }, style]}>
      <Animated.View style={{ width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,0.055)', transform: [{ translateX: tx }] }} />
    </View>
  );
};

/* ═══════════════════════════════════════════════════════════
   HOOK PERSISTENCIA
═══════════════════════════════════════════════════════════ */
const usePersistedState = <T,>(key: string, init: T) => {
  const [val, setVal] = useState<T>(init);
  useEffect(() => { AsyncStorage.getItem(key).then(s => { if (s) setVal(JSON.parse(s)); }); }, []);
  const update = async (v: T) => { setVal(v); await AsyncStorage.setItem(key, JSON.stringify(v)); };
  return [val, update] as const;
};

/* ═══════════════════════════════════════════════════════════
   REPRODUCTOR TV EN VIVO (independiente, con estado propio)
═══════════════════════════════════════════════════════════ */
const LivePlayerSection = memo(({
  primaryColor, listaCanales, loadingChannels, refreshing, onRefresh,
  favorites, setFavorites,
}: {
  primaryColor: string; listaCanales: Canal[]; loadingChannels: boolean;
  refreshing: boolean; onRefresh: () => void;
  favorites: string[]; setFavorites: (v: string[]) => void;
}) => {
  const [canal,          setCanal]          = useState<Canal | null>(null);
  const [linkM3u8,       setLinkM3u8]       = useState<string | null>(null);
  const [cazando,        setCazando]        = useState(false);
  const [tntBuscando,    setTntBuscando]    = useState(false);
  const [tntWebView,     setTntWebView]     = useState(false);
  const [fullscreen,     setFullscreen]     = useState(false);
  const [aspect,         setAspect]         = useState<'contain' | 'fill'>('contain');
  const [busqueda,       setBusqueda]       = useState('');
  const [catActiva,      setCatActiva]      = useState('Todos');
  const [categorias,     setCategorias]     = useState<string[]>(['Todos']);
  const [recents,        setRecents]        = useState<Canal[]>([]);
  const [numeroMarcado,  setNumeroMarcado]  = useState('');
  const [errorCanal,     setErrorCanal]     = useState(false);

  const canalRef      = useRef<Canal | null>(null);
  const tntWebViewRef = useRef<WebView>(null);
  const webViewRef    = useRef<WebView>(null);
  const timerCaza     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerZap      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tntRetry      = useRef(0);
  const inputRef      = useRef<TextInput>(null);
  const liveDot       = useRef(new Animated.Value(1)).current;
  const panRef        = useRef<any>(null);

  useEffect(() => { canalRef.current = canal; }, [canal]);

  useEffect(() => {
    const cats = new Set<string>(['Todos']);
    listaCanales.forEach(c => cats.add(c.category));
    if (favorites.length > 0) cats.add('Favoritos');
    setCategorias(Array.from(cats));
    if (!canal && listaCanales.length > 0) sintonizar(listaCanales[0]);
  }, [listaCanales]);

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(liveDot, { toValue: 0.1, duration: 850, useNativeDriver: true }),
      Animated.timing(liveDot, { toValue: 1,   duration: 850, useNativeDriver: true }),
    ]));
    pulse.start(); return () => pulse.stop();
  }, []);

  // PanResponder para swipe entre canales y doble tap fullscreen
  const lastTapRef = useRef<number | null>(null);
  if (!panRef.current) {
    panRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (_, g) => {
        const now = Date.now();
        if (lastTapRef.current && now - lastTapRef.current < 280) { setFullscreen(true); lastTapRef.current = null; return; }
        lastTapRef.current = now;
        if (Math.abs(g.dx) > 50 && Math.abs(g.dx) > Math.abs(g.dy)) {
          if (g.dx > 0) canalAnterior(); else canalSiguiente();
        }
      },
    });
  }

  const limpiarCaza = () => { if (timerCaza.current) { clearTimeout(timerCaza.current); timerCaza.current = null; } };

  const obtenerStreamTNT = async (url: string): Promise<string | null> => {
    const slugM = url.match(/[?&]canal=([^&]+)/i);
    const slug  = slugM ? slugM[1] : '';
    const base  = 'https://regionales.saohgdasregions.fun';
    const emb   = 'https://embed.saohgdasregions.fun';
    const UA    = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
    const intentos = [
      { url, referer: `${emb}/embed2/${slug}.html` },
      { url: `${emb}/embed2/${slug}.html`, referer: `${emb}/` },
      { url: `${base}/stream.php?canal=${slug}`, referer: `${emb}/embed2/${slug}.html` },
    ];
    for (const { url: u, referer } of intentos) {
      try {
        const res  = await fetch(u, { headers: { 'User-Agent': UA, 'Referer': referer, 'Origin': emb } });
        const html = await res.text();
        const m    = html.match(/https?:\/\/[^\s"'<>]+?\.m3u8(?:\?[^\s"'<>]*)?/i);
        if (m) return m[0];
      } catch (_) {}
    }
    return null;
  };

  const sintonizar = async (c: Canal) => {
    limpiarCaza();
    setLinkM3u8(null);
    setCanal(c);
    setTntBuscando(false);
    setTntWebView(false);
    setCazando(false);
    setRecents(prev => [c, ...prev.filter(x => x.id !== c.id)].slice(0, 8));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (esUrlManifiesto(c.url)) { setLinkM3u8(c.url); return; }
    if (c.needsWebView) {
      tntRetry.current = 0;
      setTntBuscando(true);
      const stream = await obtenerStreamTNT(c.url);
      if (stream) { setLinkM3u8(stream); setTntBuscando(false); }
      else {
        setTntWebView(true);
        timerCaza.current = setTimeout(() => {
          setTntBuscando(false); setTntWebView(false); limpiarCaza();
          Alert.alert(c.name, 'Canal offline o inaccesible.');
        }, 26000);
      }
      return;
    }
    setCazando(true);
    timerCaza.current = setTimeout(() => setCazando(false), 15000);
  };

  const reextraerTNT = useCallback(async () => {
    if (tntRetry.current >= 4) { setLinkM3u8(null); setTntBuscando(false); setTntWebView(false); return; }
    tntRetry.current++;
    setLinkM3u8(null); setTntBuscando(true); setTntWebView(false);
    await new Promise(r => setTimeout(r, 1500));
    const stream = await obtenerStreamTNT(canalRef.current?.url ?? '');
    if (stream) { setLinkM3u8(stream); setTntBuscando(false); }
    else { setTntWebView(true); timerCaza.current = setTimeout(() => { setTntBuscando(false); setTntWebView(false); limpiarCaza(); }, 26000); }
  }, []);

  const onMsgTNT = (e: WebViewMessageEvent) => {
    const data = String(e.nativeEvent.data || '').trim();
    if (data.startsWith('FOUND_MANIFEST:')) {
      setLinkM3u8(data.replace('FOUND_MANIFEST:', '')); setTntBuscando(false); setTntWebView(false); limpiarCaza(); return;
    }
    if (esUrlManifiesto(data)) { setLinkM3u8(data); setTntBuscando(false); setTntWebView(false); limpiarCaza(); return; }
    if (data === 'MANIFEST_TIMEOUT') { setTntBuscando(false); setTntWebView(false); limpiarCaza(); Alert.alert('Canal', 'No se pudo extraer el stream.'); }
  };

  const onMsgWebView = (e: WebViewMessageEvent) => {
    const m = extraerManifiesto(String(e.nativeEvent.data || ''));
    if (m) { setLinkM3u8(m); setCazando(false); limpiarCaza(); }
  };

  const canalSiguiente = () => {
    const lista = listaCanales; if (!canal || !lista.length) return;
    const idx = lista.findIndex(c => c.id === canal.id);
    sintonizar(lista[(idx + 1) % lista.length]);
  };
  const canalAnterior = () => {
    const lista = listaCanales; if (!canal || !lista.length) return;
    const idx = lista.findIndex(c => c.id === canal.id);
    sintonizar(lista[idx === 0 ? lista.length - 1 : idx - 1]);
  };

  const alMarcrarNumero = (txt: string) => {
    const n = txt.replace(/[^0-9]/g, '');
    if (!n) return;
    setNumeroMarcado(n);
    if (timerZap.current) clearTimeout(timerZap.current);
    timerZap.current = setTimeout(() => {
      const found = listaCanales.find(c => c.numero === parseInt(n, 10));
      if (found) sintonizar(found);
      else { setErrorCanal(true); setTimeout(() => setErrorCanal(false), 1800); }
      setNumeroMarcado('');
    }, 1400);
  };

  const onPlayerError = useCallback(() => {
    if (canal?.needsWebView) { reextraerTNT(); return; }
    setLinkM3u8(null); limpiarCaza();
    setTimeout(() => { if (canalRef.current) sintonizar(canalRef.current); }, 500);
  }, [canal]);

  const canalesFiltrados = listaCanales.filter(c => {
    const matchCat = catActiva === 'Todos' ? true : catActiva === 'Favoritos' ? favorites.includes(c.id) : c.category === catActiva;
    return matchCat && c.name.toLowerCase().includes(busqueda.toLowerCase());
  });

  // Fullscreen mode
  if (fullscreen) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {linkM3u8
            ? <ReproductorNativo url={linkM3u8} contentFit={aspect} isLive onError={onPlayerError} onStall={reextraerTNT} />
            : <View style={lv.noSignal}><Ionicons name="tv-outline" size={52} color={T.color.textMuted} /><Text style={lv.noSignalTxt}>Sin señal</Text></View>
          }
          <TouchableOpacity style={lv.fsExit} onPress={() => setFullscreen(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        ref={inputRef} value={numeroMarcado} onChangeText={alMarcrarNumero}
        keyboardType="numeric" showSoftInputOnFocus={false}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />

      {/* ── Player EN VIVO ── */}
      <View style={[lv.playerBox, { height: LIVE_PLAYER_H }]} {...panRef.current.panHandlers}>
        {tntBuscando ? (
          <View style={lv.noSignal}>
            <ActivityIndicator size="large" color={primaryColor} />
            <Text style={[lv.noSignalTxt, { marginTop: 10 }]}>Conectando a {canal?.name ?? 'canal'}…</Text>
            <Text style={{ color: T.color.textMuted, fontSize: T.font.xs, marginTop: 4 }}>Obteniendo señal en vivo</Text>
          </View>
        ) : linkM3u8 ? (
          <ReproductorNativo url={linkM3u8} contentFit={aspect} isLive onError={onPlayerError} onStall={reextraerTNT} />
        ) : (
          <View style={lv.noSignal}>
            <Ionicons name="tv-outline" size={50} color={T.color.textMuted} />
            <Text style={lv.noSignalTxt}>Sin señal</Text>
          </View>
        )}

        {/* Controles nav */}
        <TouchableOpacity style={lv.navLeft}  onPress={canalAnterior}><Ionicons name="chevron-back"    size={26} color="#fff" /></TouchableOpacity>
        <TouchableOpacity style={lv.navRight} onPress={canalSiguiente}><Ionicons name="chevron-forward" size={26} color="#fff" /></TouchableOpacity>

        {/* Top bar */}
        <View style={lv.topBar} pointerEvents="box-none">
          {canal && (
            <View style={lv.livePill}>
              <Animated.View style={[lv.liveDot, { opacity: liveDot }]} />
              <Text style={lv.liveTxt}>EN VIVO</Text>
            </View>
          )}
          <View style={lv.topBarRight}>
            <TouchableOpacity style={lv.iconBtn} onPress={() => setAspect(a => a === 'contain' ? 'fill' : 'contain')}>
              <Ionicons name="scan-outline"   size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={lv.iconBtn} onPress={() => setFullscreen(true)}>
              <Ionicons name="expand-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom info */}
        <View style={lv.bottomBar} pointerEvents="none">
          {canal && (
            <View style={lv.channelInfoRow}>
              <Text style={[lv.chNum, { color: primaryColor }]}>{canal.numero}</Text>
              <View style={{ flex: 1, marginLeft: T.space.sm }}>
                <Text style={lv.chName} numberOfLines={1}>{canal.name}</Text>
                {canal.nowPlaying ? <Text style={lv.chNow} numberOfLines={1}>▶ {canal.nowPlaying}</Text> : null}
              </View>
            </View>
          )}
        </View>

        {/* OSD número */}
        {numeroMarcado !== '' && (
          <View style={lv.osd}><Text style={[lv.osdTxt, { color: primaryColor }]}>{numeroMarcado}</Text></View>
        )}
        {errorCanal && (
          <View style={lv.osdError}><Text style={lv.osdErrTxt}>CANAL NO ENCONTRADO</Text></View>
        )}
      </View>

      {/* ── Recientes ── */}
      {recents.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={lv.recentsRow} contentContainerStyle={{ paddingHorizontal: T.space.lg }}>
          {recents.map(ch => (
            <TouchableOpacity key={ch.id} style={[lv.recentChip, canal?.id === ch.id && { backgroundColor: primaryColor }]} onPress={() => sintonizar(ch)}>
              <Text style={[lv.recentTxt, canal?.id === ch.id && { color: '#fff' }]}>{ch.numero} {ch.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Búsqueda ── */}
      <View style={lv.searchRow}>
        <Ionicons name="search" size={16} color={T.color.textMuted} style={{ marginRight: T.space.sm }} />
        <TextInput
          style={lv.searchInput} placeholder="Buscar canal..." placeholderTextColor={T.color.textMuted}
          value={busqueda} onChangeText={setBusqueda}
        />
        {busqueda !== '' && (
          <TouchableOpacity onPress={() => setBusqueda('')}><Ionicons name="close-circle" size={18} color={T.color.textMuted} /></TouchableOpacity>
        )}
      </View>

      {/* ── Categorías ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={lv.catRow} contentContainerStyle={{ paddingHorizontal: T.space.lg }}>
        {categorias.map(cat => (
          <TouchableOpacity
            key={cat} onPress={() => { setCatActiva(cat); Haptics.selectionAsync(); }}
            style={[lv.catChip, catActiva === cat && { backgroundColor: primaryColor }]}
          >
            <Text style={[lv.catTxt, catActiva === cat && { color: '#fff', fontWeight: T.font.bold }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Lista canales ── */}
      {loadingChannels ? (
        <View style={{ paddingHorizontal: T.space.lg, gap: T.space.sm }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Shimmer w={s(40)} h={s(28)} style={{ marginRight: T.space.md }} />
              <Shimmer w={s(160)} h={s(14)} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={canalesFiltrados}
          keyExtractor={item => item.id}
          getItemLayout={(_, i) => ({ length: s(70), offset: s(70) * i, index: i })}
          contentContainerStyle={{ paddingHorizontal: T.space.lg, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
          renderItem={({ item }) => {
            const active = canal?.id === item.id;
            const fav    = favorites.includes(item.id);
            return (
              <TouchableOpacity
                style={[lv.channelRow, active && { borderColor: primaryColor, borderLeftWidth: 3, backgroundColor: T.color.surfaceElevated }]}
                onPress={() => sintonizar(item)} activeOpacity={0.75}
              >
                <View style={[lv.numBadge, { backgroundColor: active ? primaryColor : T.color.surfaceElevated }]}>
                  <Text style={[lv.numTxt, { color: active ? '#fff' : T.color.textSecondary }]}>{item.numero}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[lv.rowName, active && { color: '#fff', fontWeight: T.font.bold }]} numberOfLines={1}>{item.name}</Text>
                  {item.nowPlaying ? <Text style={lv.rowNow} numberOfLines={1}>{item.nowPlaying}</Text> : null}
                </View>
                <TouchableOpacity
                  onPress={() => setFavorites(fav ? favorites.filter(id => id !== item.id) : [...favorites, item.id])}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name={fav ? 'star' : 'star-outline'} size={18} color={fav ? T.color.gold : T.color.textMuted} />
                </TouchableOpacity>
                {item.logo
                  ? <Image source={{ uri: item.logo }} style={lv.logo} />
                  : <View style={lv.logoPlaceholder}><Ionicons name="tv" size={14} color={T.color.textMuted} /></View>
                }
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* WebViews ocultas para extracción de streams */}
      {cazando && canal && !canal.needsWebView && (
        <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
          <WebView
            ref={webViewRef}
            source={{ uri: canal.url, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'es-ES,es;q=0.9' } }}
            originWhitelist={['*']} javaScriptEnabled domStorageEnabled cacheEnabled={false}
            mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback mixedContentMode="always"
            injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE}
            injectedJavaScript={INJECT_AFTER}
            onMessage={onMsgWebView}
          />
        </View>
      )}
      {tntWebView && canal?.needsWebView && (
        <View style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
          <WebView
            ref={tntWebViewRef}
            source={{ uri: canal.url }}
            originWhitelist={['*']} javaScriptEnabled domStorageEnabled
            mediaPlaybackRequiresUserAction={false} allowsInlineMediaPlayback mixedContentMode="always"
            injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE}
            injectedJavaScript={INJECT_AFTER}
            onMessage={onMsgTNT}
          />
        </View>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════
   REPRODUCTOR VOD (Películas / Series — independiente)
═══════════════════════════════════════════════════════════ */
const VodPlayerSection = memo(({
  tipo, primaryColor,
}: { tipo: 'movie' | 'tv'; primaryColor: string }) => {
  const driveKey    = tipo === 'movie' ? DRIVE_FOLDER_PELICULAS : DRIVE_FOLDER_SERIES;
  const cacheKey    = tipo === 'movie' ? 'driveMoviesCache' : 'driveSeriesCache';
  const storeKeyC   = tipo === 'movie' ? 'customMovies' : 'customSeries';

  // Estado del reproductor VOD (completamente local a esta sección)
  const [vodUrl,      setVodUrl]      = useState<string | null>(null);
  const [vodItem,     setVodItem]     = useState<MediaItem | null>(null);
  const [fullscreen,  setFullscreen]  = useState(false);
  const [aspect,      setAspect]      = useState<'contain' | 'fill'>('contain');

  // Catálogos
  const [categoria,       setCategoria]       = useState<'popular' | 'top_rated' | 'drive' | 'custom'>('drive');
  const [tmdbItems,       setTmdbItems]       = useState<MediaItem[]>(tipo === 'movie' ? MOVIES_FALLBACK : SERIES_FALLBACK);
  const [loadingTmdb,     setLoadingTmdb]     = useState(false);
  const [tmdbPage,        setTmdbPage]        = useState(1);
  const [driveItems,      setDriveItems]      = useState<MediaItem[]>([]);
  const [loadingDrive,    setLoadingDrive]    = useState(false);
  const [customItems,     setCustomItems]     = usePersistedState<MediaItem[]>(storeKeyC, []);
  const [watchlist,       setWatchlist]       = usePersistedState<string[]>(`watchlist_${tipo}`, []);

  // Detail modal
  const [detailItem,  setDetailItem]  = useState<MediaItem | null>(null);
  const [detailOpen,  setDetailOpen]  = useState(false);

  // Add form
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addPoster, setAddPoster] = useState('');
  const [addStream, setAddStream] = useState('');
  const [addYear, setAddYear] = useState('');
  const [addSeasons, setAddSeasons] = useState('');

  // Error reproductor
  const [vodError, setVodError] = useState(false);

  // Cargar Drive al montar o cambiar a tab drive
  useEffect(() => {
    if (categoria === 'drive' && driveItems.length === 0) cargarDrive();
  }, [categoria]);

  // Cargar TMDB al cambiar categoría
  useEffect(() => {
    if (categoria === 'popular' || categoria === 'top_rated') fetchTmdb(categoria, 1);
  }, [categoria]);

  const fetchTmdb = async (cat: string, page: number) => {
    setLoadingTmdb(true);
    const base = tipo === 'movie' ? 'movie' : 'tv';
    const ep   = cat === 'popular' ? 'popular' : 'top_rated';
    try {
      const res  = await fetch(`https://api.themoviedb.org/3/${base}/${ep}?api_key=${TMDB_API_KEY}&language=es&page=${page}`);
      const data = await res.json();
      const formatted: MediaItem[] = (data.results || []).map((m: any) => ({
        id:       m.id.toString(),
        title:    tipo === 'movie' ? m.title : m.name,
        poster:   `https://image.tmdb.org/t/p/w500${m.poster_path}`,
        backdrop: `https://image.tmdb.org/t/p/w780${m.backdrop_path}`,
        year:     tipo === 'movie'
          ? (m.release_date   ? new Date(m.release_date).getFullYear()    : undefined)
          : (m.first_air_date ? new Date(m.first_air_date).getFullYear()  : undefined),
        rating:   m.vote_average?.toFixed(1) ?? '0.0',
        seasons:  tipo === 'tv' ? m.number_of_seasons : undefined,
        overview: m.overview,
        type:     tipo,
      }));
      if (page === 1) setTmdbItems(formatted);
      else setTmdbItems(prev => [...prev, ...formatted]);
    } catch {
      if (page === 1) setTmdbItems(tipo === 'movie' ? MOVIES_FALLBACK : SERIES_FALLBACK);
    } finally { setLoadingTmdb(false); }
  };

  const cargarDrive = async () => {
    setLoadingDrive(true);
    const items = await cargarCarpetaDrive(driveKey, tipo, cacheKey);
    setDriveItems(items);
    setLoadingDrive(false);
  };

  const reproducir = (item: MediaItem) => {
    if (!item.streamUrl) return;
    setVodUrl(item.streamUrl);
    setVodItem(item);
    setVodError(false);
    setDetailOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const cerrarVod = () => { setVodUrl(null); setVodItem(null); setVodError(false); };

  const handleAddItem = () => {
    if (!addTitle.trim()) { Alert.alert('Error', 'El título es obligatorio.'); return; }
    const item: MediaItem = {
      id: Date.now().toString(), title: addTitle.trim(),
      poster: addPoster.trim() || 'https://via.placeholder.com/500x750.png?text=Sin+Imagen',
      streamUrl: addStream.trim(), year: addYear ? parseInt(addYear) : new Date().getFullYear(),
      rating: '0.0', seasons: tipo === 'tv' && addSeasons ? parseInt(addSeasons) : undefined,
      type: tipo, custom: true,
    };
    setCustomItems([item, ...customItems]);
    setAddOpen(false); setAddTitle(''); setAddPoster(''); setAddStream(''); setAddYear(''); setAddSeasons('');
  };

  const datos: MediaItem[] = categoria === 'drive' ? driveItems : categoria === 'custom' ? customItems : tmdbItems;
  const cargando = categoria === 'drive' ? loadingDrive : loadingTmdb;

  if (fullscreen && vodUrl) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <StatusBar hidden />
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <ReproductorNativo url={vodUrl} contentFit={aspect} onError={() => setVodError(true)} />
          <TouchableOpacity style={lv.fsExit} onPress={() => setFullscreen(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* ── Player VOD (solo visible si hay algo reproduciendo) ── */}
      {vodUrl && vodItem && (
        <View style={[vd.playerBox, { height: VOD_PLAYER_H }]}>
          {vodError ? (
            <View style={lv.noSignal}>
              <Ionicons name="alert-circle-outline" size={40} color={T.color.primary} />
              <Text style={[lv.noSignalTxt, { marginTop: 8 }]}>Error al reproducir</Text>
              <TouchableOpacity style={[vd.retryBtn, { backgroundColor: primaryColor }]} onPress={() => { setVodError(false); setVodUrl(null); setTimeout(() => setVodUrl(vodItem.streamUrl ?? null), 300); }}>
                <Text style={{ color: '#fff', fontSize: T.font.sm, fontWeight: T.font.bold }}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ReproductorNativo url={vodUrl} contentFit={aspect} onError={() => setVodError(true)} />
          )}

          {/* Controles */}
          <View style={vd.playerControls} pointerEvents="box-none">
            <View style={{ flexDirection: 'row', gap: T.space.sm }}>
              <TouchableOpacity style={lv.iconBtn} onPress={() => setAspect(a => a === 'contain' ? 'fill' : 'contain')}>
                <Ionicons name="scan-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={lv.iconBtn} onPress={() => setFullscreen(true)}>
                <Ionicons name="expand-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={lv.iconBtn} onPress={cerrarVod}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Info bottom */}
          <View style={vd.playerInfo} pointerEvents="none">
            <Image source={{ uri: vodItem.poster }} style={vd.miniPoster} />
            <View style={{ flex: 1, marginLeft: T.space.sm }}>
              <Text style={vd.vodTitle} numberOfLines={1}>{vodItem.title}</Text>
              <Text style={vd.vodMeta}>{vodItem.year}{tipo === 'tv' && vodItem.seasons ? ` · ${vodItem.seasons} temp.` : ''}</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Categorías ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={lv.catRow} contentContainerStyle={{ paddingHorizontal: T.space.lg }}>
          {([
            { key: 'drive',     label: 'Mi Drive' },
            { key: 'popular',   label: 'Populares' },
            { key: 'top_rated', label: 'Mejor valoradas' },
            { key: 'custom',    label: 'Mi contenido' },
          ] as const).map(({ key, label }) => (
            <TouchableOpacity
              key={key} onPress={() => { setCategoria(key); setTmdbPage(1); }}
              style={[lv.catChip, categoria === key && { backgroundColor: primaryColor }]}
            >
              <Text style={[lv.catTxt, categoria === key && { color: '#fff', fontWeight: T.font.bold }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {categoria === 'custom' && (
          <TouchableOpacity style={[vd.addBtn, { backgroundColor: primaryColor }]} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Formulario agregar ── */}
      {addOpen && (
        <View style={vd.addForm}>
          <Text style={vd.addFormTitle}>Agregar {tipo === 'movie' ? 'Película' : 'Serie'}</Text>
          <TextInput style={vd.addInput} placeholder="Título *" placeholderTextColor={T.color.textMuted} value={addTitle} onChangeText={setAddTitle} />
          <TextInput style={vd.addInput} placeholder="URL del poster" placeholderTextColor={T.color.textMuted} value={addPoster} onChangeText={setAddPoster} />
          <TextInput style={vd.addInput} placeholder="URL de reproducción" placeholderTextColor={T.color.textMuted} value={addStream} onChangeText={setAddStream} />
          <TextInput style={vd.addInput} placeholder="Año" placeholderTextColor={T.color.textMuted} value={addYear} onChangeText={setAddYear} keyboardType="numeric" />
          {tipo === 'tv' && <TextInput style={vd.addInput} placeholder="Temporadas" placeholderTextColor={T.color.textMuted} value={addSeasons} onChangeText={setAddSeasons} keyboardType="numeric" />}
          <View style={{ flexDirection: 'row', gap: T.space.sm, marginTop: T.space.sm }}>
            <TouchableOpacity style={[vd.addBtnSmall, { backgroundColor: primaryColor, flex: 1 }]} onPress={handleAddItem}><Text style={{ color: '#fff', fontWeight: T.font.bold }}>Agregar</Text></TouchableOpacity>
            <TouchableOpacity style={[vd.addBtnSmall, { backgroundColor: T.color.surfaceElevated, flex: 1 }]} onPress={() => setAddOpen(false)}><Text style={{ color: T.color.textSecondary }}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Grid de contenido ── */}
      {cargando ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={{ color: T.color.textMuted, marginTop: 10 }}>
            {categoria === 'drive' ? 'Cargando tu Drive…' : 'Cargando…'}
          </Text>
        </View>
      ) : datos.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={categoria === 'drive' ? 'cloud-outline' : 'film-outline'} size={52} color={T.color.textMuted} />
          <Text style={{ color: T.color.textMuted, marginTop: 12, fontSize: T.font.sm }}>
            {categoria === 'drive' ? 'No hay videos en tu Drive' : 'No hay contenido aquí aún'}
          </Text>
          {categoria === 'drive' && (
            <TouchableOpacity style={[vd.addBtnSmall, { backgroundColor: primaryColor, marginTop: T.space.md }]} onPress={cargarDrive}>
              <Text style={{ color: '#fff', fontWeight: T.font.bold }}>Recargar</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={datos}
          keyExtractor={item => item.id}
          numColumns={MEDIA_COLS}
          contentContainerStyle={{ paddingHorizontal: T.space.lg, paddingBottom: 24, paddingTop: T.space.sm }}
          columnWrapperStyle={MEDIA_COLS > 1 ? { gap: T.space.md, marginBottom: T.space.md } : undefined}
          refreshControl={categoria === 'drive' ? <RefreshControl refreshing={loadingDrive} onRefresh={cargarDrive} tintColor={primaryColor} /> : undefined}
          onEndReached={() => {
            if (categoria === 'popular' || categoria === 'top_rated') { const next = tmdbPage + 1; setTmdbPage(next); fetchTmdb(categoria, next); }
          }}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => {
            const inWl = watchlist.includes(item.id);
            return (
              <TouchableOpacity style={vd.card} onPress={() => { setDetailItem(item); setDetailOpen(true); }} activeOpacity={0.82}>
                <Image source={{ uri: item.poster }} style={vd.poster} resizeMode="cover" />
                <View style={vd.cardOverlay} />
                {/* Play indicator if currently playing */}
                {vodItem?.id === item.id && (
                  <View style={[vd.playingBadge, { backgroundColor: primaryColor }]}>
                    <Ionicons name="play" size={10} color="#fff" />
                  </View>
                )}
                {item.custom && (
                  <View style={vd.customBadge}><Text style={vd.customBadgeTxt}>DRIVE</Text></View>
                )}
                <View style={vd.cardBottom}>
                  <Text style={vd.cardTitle} numberOfLines={2}>{item.title}</Text>
                  {item.rating && item.rating !== '0.0' && (
                    <View style={[vd.ratingPill, { backgroundColor: primaryColor + '22' }]}>
                      <Text style={[vd.ratingTxt, { color: primaryColor }]}>⭐ {item.rating}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Detail Modal ── */}
      {detailItem && (
        <Modal visible={detailOpen} animationType="slide" transparent={false}>
          <View style={{ flex: 1, backgroundColor: T.color.bg }}>
            <StatusBar hidden />
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {detailItem.backdrop || detailItem.poster ? (
                <Image source={{ uri: detailItem.backdrop ?? detailItem.poster }} style={vd.detailHero} resizeMode="cover" />
              ) : null}
              <View style={vd.detailGradient} />
              <TouchableOpacity style={vd.detailClose} onPress={() => setDetailOpen(false)}>
                <Ionicons name="close-circle" size={36} color="#fff" />
              </TouchableOpacity>
              <View style={vd.detailBody}>
                <View style={{ flexDirection: 'row', gap: T.space.md, marginBottom: T.space.lg }}>
                  <Image source={{ uri: detailItem.poster }} style={vd.detailPoster} resizeMode="cover" />
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <Text style={vd.detailTitle}>{detailItem.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: T.space.sm, marginTop: T.space.xs }}>
                      {detailItem.rating && detailItem.rating !== '0.0' && (
                        <Text style={[vd.detailRating, { color: primaryColor }]}>⭐ {detailItem.rating}</Text>
                      )}
                      {detailItem.year && <Text style={vd.detailMeta}>{detailItem.year}</Text>}
                      {detailItem.seasons && <Text style={vd.detailMeta}>{detailItem.seasons} temp.</Text>}
                    </View>
                  </View>
                </View>
                <Text style={vd.detailOverview}>{detailItem.overview ?? 'Sin descripción.'}</Text>
                <View style={{ flexDirection: 'row', gap: T.space.sm, marginTop: T.space.lg }}>
                  {detailItem.streamUrl ? (
                    <TouchableOpacity
                      style={[vd.detailBtn, { backgroundColor: primaryColor, flex: 1 }]}
                      onPress={() => reproducir(detailItem)}
                    >
                      <Ionicons name="play" size={18} color="#fff" />
                      <Text style={vd.detailBtnTxt}>Reproducir</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[vd.detailBtn, { backgroundColor: watchlist.includes(detailItem.id) ? primaryColor : T.color.surfaceElevated, flex: 1 }]}
                    onPress={() => setWatchlist(watchlist.includes(detailItem.id) ? watchlist.filter(id => id !== detailItem.id) : [...watchlist, detailItem.id])}
                  >
                    <Ionicons name={watchlist.includes(detailItem.id) ? 'checkmark' : 'add'} size={18} color="#fff" />
                    <Text style={vd.detailBtnTxt}>{watchlist.includes(detailItem.id) ? 'En mi lista' : 'Mi lista'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════
   AJUSTES
═══════════════════════════════════════════════════════════ */
const AjustesSection = ({ primaryColor, accentColor, setAccentColor, onRefreshChannels }: any) => {
  const [appId, setAppId] = useState('');
  useEffect(() => {
    AsyncStorage.getItem('appId').then(id => {
      if (!id) { id = 'NXTV-' + Math.random().toString(36).substr(2, 6).toUpperCase(); AsyncStorage.setItem('appId', id); }
      setAppId(id ?? '');
    });
  }, []);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={aj.sectionTitle}>Personalización</Text>
      <View style={aj.card}>
        <Text style={aj.label}>Color de acento</Text>
        <View style={{ flexDirection: 'row', gap: T.space.sm, marginTop: T.space.sm }}>
          {Object.entries(ACCENT_COLORS).map(([key, color]) => (
            <TouchableOpacity
              key={key} onPress={() => setAccentColor(key)}
              style={[aj.colorDot, { backgroundColor: color, borderWidth: accentColor === key ? 3 : 0, borderColor: '#fff' }]}
            />
          ))}
        </View>
      </View>
      <Text style={aj.sectionTitle}>Canales</Text>
      <TouchableOpacity style={aj.card} onPress={onRefreshChannels}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={aj.label}>Actualizar lista M3U</Text>
          <Ionicons name="refresh" size={20} color={primaryColor} />
        </View>
      </TouchableOpacity>
      <Text style={aj.sectionTitle}>Información</Text>
      <View style={aj.card}>
        <Text style={aj.label}>Identificador de dispositivo</Text>
        <Text style={[aj.value, { color: primaryColor, marginTop: 4 }]} selectable>{appId}</Text>
      </View>
      <View style={aj.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={aj.label}>Versión</Text>
          <Text style={aj.value}>3.3.0</Text>
        </View>
      </View>
      <View style={aj.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={aj.label}>Plataforma</Text>
          <Text style={aj.value}>{Platform.OS.toUpperCase()} {IS_TV ? '· TV' : IS_TABLET ? '· Tablet' : '· Móvil'}</Text>
        </View>
      </View>
    </ScrollView>
  );
};

/* ═══════════════════════════════════════════════════════════
   APP PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function App() {
  const [splash,    setSplash]    = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  // Estado de canales (compartido para la sección TV y ajustes)
  const [listaCanales,    setListaCanales]    = useState<Canal[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [favorites,       setFavorites]       = usePersistedState<string[]>('favorites', []);
  const [accentColor,     setAccentColor]     = usePersistedState<string>('accentColor', 'red');

  const primaryColor  = ACCENT_COLORS[accentColor] || ACCENT_COLORS.red;
  const cargaEnCurso  = useRef(false);

  /* ── SPLASH ── */
  const splashOp   = useRef(new Animated.Value(0)).current;
  const splashSc   = useRef(new Animated.Value(0.94)).current;
  const ringRot    = useRef(new Animated.Value(0)).current;
  const glowPulse  = useRef(new Animated.Value(0.85)).current;
  const progressA  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    Animated.parallel([
      Animated.timing(splashOp, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(splashSc, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const rot  = Animated.loop(Animated.timing(ringRot,   { toValue: 1, duration: 3800, easing: Easing.linear, useNativeDriver: true }));
    const glow = Animated.loop(Animated.sequence([
      Animated.timing(glowPulse, { toValue: 1.12, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(glowPulse, { toValue: 0.82, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    rot.start(); glow.start();
    Animated.timing(progressA, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(splashOp, { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.timing(splashSc, { toValue: 1.04, duration: 320, useNativeDriver: true }),
      ]).start(() => setSplash(false));
    }, 2700);
    return () => { clearTimeout(t); rot.stop(); glow.stop(); };
  }, []);

  /* ── CARGA M3U ── */
  const cargarListaM3U = useCallback(async () => {
    if (cargaEnCurso.current) return;
    cargaEnCurso.current = true;
    setLoadingChannels(true);
    for (let i = 0; i < 3; i++) {
      try {
        const res  = await fetch(`${M3U_URL}?t=${Date.now()}`, { cache: 'no-store' });
        const txt  = await res.text();
        const lineas = txt.split('\n');
        const parsed: Canal[] = [];
        let info = { name: '', logo: '', category: 'General' };
        let idx  = 20;
        lineas.forEach(l => {
          const lim = l.trim();
          if (lim.startsWith('#EXTINF:')) {
            const parts = lim.split(',');
            info.name   = parts[parts.length - 1].trim() || 'Canal';
            info.logo   = lim.match(/tvg-logo="([^"]+)"/i)?.[1] ?? '';
            info.category = lim.match(/group-title="([^"]+)"/i)?.[1] ?? 'General';
          } else if (lim.startsWith('http')) {
            parsed.push({ id: String(3000 + idx), numero: idx++, name: info.name, logo: info.logo, category: info.category, url: lim });
            info = { name: '', logo: '', category: 'General' };
          }
        });
        setListaCanales([...CANALES_MANUALES, ...parsed]);
        break;
      } catch {
        if (i === 2) setListaCanales(CANALES_MANUALES);
        await new Promise(r => setTimeout(r, 800));
      }
    }
    setLoadingChannels(false);
    cargaEnCurso.current = false;
  }, []);

  useEffect(() => { cargarListaM3U(); }, []);

  const onRefresh = useCallback(async () => { setRefreshing(true); await cargarListaM3U(); setRefreshing(false); }, [cargarListaM3U]);

  const tabOpacity = useRef(new Animated.Value(1)).current;
  const changeTab  = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(tabOpacity, { toValue: 0, duration: 90, useNativeDriver: true }).start(() => {
      setActiveTab(i);
      Animated.timing(tabOpacity, { toValue: 1, duration: 90, useNativeDriver: true }).start();
    });
  };

  /* ── SPLASH RENDER ── */
  if (splash) {
    const spin         = ringRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const progressWidth = progressA.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
    return (
      <View style={sp.root}>
        <StatusBar hidden />
        <View style={sp.bgOrb1} /><View style={sp.bgOrb2} />
        <Animated.View style={[sp.center, { opacity: splashOp, transform: [{ scale: splashSc }] }]}>
          <Animated.View style={[sp.logoGlow, { transform: [{ scale: glowPulse }] }]} />
          <Animated.View style={[sp.ring, { transform: [{ rotate: spin }] }]}>
            <View style={sp.ringDot1} /><View style={sp.ringDot2} />
          </Animated.View>
          <View style={sp.logoCore}>
            <Text style={sp.logoN}>N</Text>
          </View>
          <Text style={sp.title}>NEXUS<Text style={sp.accent}>TV</Text></Text>
          <Text style={sp.sub}>STREAMING PREMIUM</Text>
          <View style={sp.track}>
            <Animated.View style={[sp.fill, { width: progressWidth }]} />
          </View>
          <Text style={sp.loadTxt}>SINTONIZANDO CANALES</Text>
        </Animated.View>
      </View>
    );
  }

  /* ── MAIN RENDER ── */
  return (
    <View style={main.container}>
      <StatusBar barStyle="light-content" backgroundColor={T.color.bg} />

      {/* Header */}
      <View style={main.header}>
        <Text style={main.logo}>NEXUS<Text style={[main.logoAccent, { color: primaryColor }]}>TV</Text></Text>
        <View style={main.headerRight}>
          <TouchableOpacity style={main.headerBtn}>
            <Ionicons name="notifications-outline" size={20} color={T.color.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={main.headerBtn}>
            <View style={[main.avatar, { backgroundColor: primaryColor }]}>
              <Text style={main.avatarTxt}>U</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido de la pestaña activa */}
      <Animated.View style={[{ flex: 1 }, { opacity: tabOpacity }]}>
        {activeTab === 0 && (
          <LivePlayerSection
            primaryColor={primaryColor}
            listaCanales={listaCanales}
            loadingChannels={loadingChannels}
            refreshing={refreshing}
            onRefresh={onRefresh}
            favorites={favorites}
            setFavorites={setFavorites}
          />
        )}
        {activeTab === 1 && (
          <VodPlayerSection tipo="movie" primaryColor={primaryColor} />
        )}
        {activeTab === 2 && (
          <VodPlayerSection tipo="tv" primaryColor={primaryColor} />
        )}
        {activeTab === 3 && (
          <AjustesSection
            primaryColor={primaryColor}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            onRefreshChannels={cargarListaM3U}
          />
        )}
      </Animated.View>

      {/* Tab Bar */}
      <View style={main.tabBar}>
        {[
          { label: 'TV En Vivo', icon: 'tv-outline',       iconA: 'tv',       idx: 0 },
          { label: 'Películas',  icon: 'film-outline',     iconA: 'film',     idx: 1 },
          { label: 'Series',     icon: 'videocam-outline', iconA: 'videocam', idx: 2 },
          { label: 'Ajustes',    icon: 'settings-outline', iconA: 'settings', idx: 3 },
        ].map(tab => (
          <TouchableOpacity key={tab.idx} style={main.tabItem} onPress={() => changeTab(tab.idx)} activeOpacity={0.75}>
            {activeTab === tab.idx && <View style={[main.tabIndicator, { backgroundColor: primaryColor }]} />}
            <Ionicons
              name={activeTab === tab.idx ? tab.iconA : tab.icon}
              size={IS_TV ? 30 : 22}
              color={activeTab === tab.idx ? primaryColor : T.color.textMuted}
            />
            <Text style={[main.tabLabel, activeTab === tab.idx && { color: T.color.textPrimary, fontWeight: T.font.semibold }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════
   ESTILOS — Live Player Section (lv)
═══════════════════════════════════════════════════════════ */
const lv = StyleSheet.create({
  playerBox: {
    width: '100%', backgroundColor: '#000', position: 'relative', overflow: 'hidden',
  },
  noSignal: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.color.surface,
  },
  noSignalTxt: { color: T.color.textMuted, fontSize: T.font.sm, marginTop: 8 },
  navLeft: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  navRight: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: T.space.md, paddingTop: T.space.sm, paddingBottom: T.space.sm,
    backgroundColor: 'rgba(0,0,0,0)',
  },
  topBarRight: { flexDirection: 'row', gap: T.space.sm, marginLeft: 'auto' },
  livePill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,45,85,0.85)',
    paddingHorizontal: T.space.sm, paddingVertical: 3, borderRadius: T.radius.full, gap: 5,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveTxt: { color: '#fff', fontSize: T.font.xs, fontWeight: T.font.bold, letterSpacing: 1 },
  iconBtn: {
    width: s(32), height: s(32), borderRadius: T.radius.sm,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: T.space.md, paddingBottom: T.space.sm, paddingTop: T.space.xl,
    background: 'transparent',
  },
  channelInfoRow: { flexDirection: 'row', alignItems: 'center' },
  chNum: { fontSize: T.font.xl, fontWeight: T.font.black, minWidth: 36 },
  chName: { color: '#fff', fontSize: T.font.md, fontWeight: T.font.bold },
  chNow: { color: 'rgba(255,255,255,0.55)', fontSize: T.font.sm, marginTop: 2 },
  osd: {
    position: 'absolute', top: '30%', left: '50%',
    transform: [{ translateX: -30 }],
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: T.radius.md,
    paddingHorizontal: T.space.lg, paddingVertical: T.space.sm,
  },
  osdTxt: { fontSize: T.font.xxl, fontWeight: T.font.black },
  osdError: {
    position: 'absolute', top: '40%', left: 20, right: 20,
    backgroundColor: 'rgba(229,9,20,0.85)', borderRadius: T.radius.md,
    padding: T.space.md, alignItems: 'center',
  },
  osdErrTxt: { color: '#fff', fontWeight: T.font.bold, letterSpacing: 1 },
  fsExit: {
    position: 'absolute', top: T.space.lg, right: T.space.lg,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: T.radius.full,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  recentsRow: { maxHeight: 40, marginTop: T.space.sm },
  recentChip: {
    backgroundColor: T.color.surfaceElevated, borderRadius: T.radius.full,
    paddingHorizontal: T.space.md, paddingVertical: T.space.xs, marginRight: T.space.sm,
  },
  recentTxt: { color: T.color.textSecondary, fontSize: T.font.sm },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: T.space.lg, marginTop: T.space.sm, marginBottom: T.space.xs,
    backgroundColor: T.color.surfaceElevated, borderRadius: T.radius.lg,
    paddingHorizontal: T.space.md, height: s(40),
  },
  searchInput: { flex: 1, color: T.color.textPrimary, fontSize: T.font.sm },
  catRow: { maxHeight: 44, marginBottom: T.space.xs },
  catChip: {
    backgroundColor: T.color.surfaceElevated, borderRadius: T.radius.full,
    paddingHorizontal: T.space.md, paddingVertical: T.space.xs,
    marginRight: T.space.sm, height: 32, justifyContent: 'center',
  },
  catTxt: { color: T.color.textSecondary, fontSize: T.font.sm },
  channelRow: {
    flexDirection: 'row', alignItems: 'center', height: s(68),
    backgroundColor: T.color.surface, borderRadius: T.radius.md,
    marginBottom: T.space.xs, paddingHorizontal: T.space.md,
    borderLeftWidth: 3, borderLeftColor: 'transparent',
  },
  numBadge: {
    width: s(38), height: s(26), borderRadius: T.radius.sm,
    alignItems: 'center', justifyContent: 'center', marginRight: T.space.md,
  },
  numTxt: { fontSize: T.font.sm, fontWeight: T.font.bold },
  rowName: { color: T.color.textSecondary, fontSize: T.font.sm },
  rowNow:  { color: T.color.textMuted, fontSize: T.font.xs, marginTop: 2 },
  logo:        { width: s(36), height: s(24), resizeMode: 'contain', marginLeft: T.space.sm },
  logoPlaceholder: {
    width: s(36), height: s(24), backgroundColor: T.color.surfaceElevated,
    borderRadius: T.radius.sm, alignItems: 'center', justifyContent: 'center', marginLeft: T.space.sm,
  },
});

/* ═══════════════════════════════════════════════════════════
   ESTILOS — VOD Section (vd)
═══════════════════════════════════════════════════════════ */
const CARD_W = (W - T.space.lg * 2 - T.space.md * (MEDIA_COLS - 1)) / MEDIA_COLS;

const vd = StyleSheet.create({
  playerBox: {
    width: '100%', backgroundColor: '#000', position: 'relative', overflow: 'hidden',
    borderBottomWidth: 1, borderBottomColor: T.color.border,
  },
  playerControls: {
    position: 'absolute', top: T.space.sm, right: T.space.md,
    flexDirection: 'row', gap: T.space.sm,
  },
  playerInfo: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: T.space.md, paddingBottom: T.space.sm, paddingTop: T.space.xl,
    backgroundColor: 'transparent',
  },
  miniPoster: { width: s(38), height: s(54), borderRadius: T.radius.sm },
  vodTitle: { color: '#fff', fontSize: T.font.md, fontWeight: T.font.bold },
  vodMeta:  { color: 'rgba(255,255,255,0.55)', fontSize: T.font.sm, marginTop: 2 },
  retryBtn: { marginTop: T.space.md, paddingHorizontal: T.space.lg, paddingVertical: T.space.sm, borderRadius: T.radius.full },
  addBtn: { width: 36, height: 36, borderRadius: T.radius.full, alignItems: 'center', justifyContent: 'center', marginRight: T.space.lg },
  addForm: {
    marginHorizontal: T.space.lg, marginBottom: T.space.sm,
    backgroundColor: T.color.surfaceElevated, borderRadius: T.radius.lg,
    padding: T.space.md,
  },
  addFormTitle: { color: T.color.textPrimary, fontSize: T.font.md, fontWeight: T.font.bold, marginBottom: T.space.sm },
  addInput: {
    backgroundColor: T.color.surface, color: T.color.textPrimary, borderRadius: T.radius.md,
    paddingHorizontal: T.space.md, height: s(40), marginBottom: T.space.sm, fontSize: T.font.sm,
  },
  addBtnSmall: { borderRadius: T.radius.md, paddingVertical: T.space.sm, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD_W, borderRadius: T.radius.lg, overflow: 'hidden',
    backgroundColor: T.color.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 10,
  },
  poster: { width: '100%', aspectRatio: 2 / 3 },
  cardOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'transparent',
  },
  cardBottom: { padding: T.space.sm },
  cardTitle: { color: T.color.textPrimary, fontSize: T.font.sm, fontWeight: T.font.semibold },
  ratingPill: { borderRadius: T.radius.full, paddingHorizontal: T.space.sm, paddingVertical: 2, marginTop: 4, alignSelf: 'flex-start' },
  ratingTxt: { fontSize: T.font.xs, fontWeight: T.font.bold },
  playingBadge: {
    position: 'absolute', top: T.space.sm, left: T.space.sm,
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  customBadge: {
    position: 'absolute', top: T.space.sm, right: T.space.sm,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: T.radius.sm,
    paddingHorizontal: T.space.xs, paddingVertical: 2,
  },
  customBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: T.font.black, letterSpacing: 0.5 },
  detailHero: { width: '100%', height: H * 0.3 },
  detailGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: H * 0.3,
    backgroundColor: 'rgba(7,7,15,0.35)',
  },
  detailClose: { position: 'absolute', top: T.space.lg, right: T.space.lg },
  detailBody:  { padding: T.space.lg },
  detailPoster: { width: s(100), height: s(150), borderRadius: T.radius.md },
  detailTitle:   { color: T.color.textPrimary, fontSize: T.font.xl, fontWeight: T.font.bold },
  detailRating:  { fontSize: T.font.sm, fontWeight: T.font.bold },
  detailMeta:    { color: T.color.textMuted, fontSize: T.font.sm },
  detailOverview:{ color: T.color.textSecondary, fontSize: T.font.sm, lineHeight: 22, marginTop: T.space.sm },
  detailBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: T.space.sm, borderRadius: T.radius.lg, paddingVertical: T.space.md,
  },
  detailBtnTxt: { color: '#fff', fontWeight: T.font.bold, fontSize: T.font.sm },
});

/* ═══════════════════════════════════════════════════════════
   ESTILOS — Ajustes (aj)
═══════════════════════════════════════════════════════════ */
const aj = StyleSheet.create({
  sectionTitle: {
    color: T.color.textMuted, fontSize: T.font.xs, fontWeight: T.font.bold,
    letterSpacing: 1.5, textTransform: 'uppercase', marginLeft: T.space.lg, marginTop: T.space.lg, marginBottom: T.space.sm,
  },
  card: {
    marginHorizontal: T.space.lg, backgroundColor: T.color.surfaceElevated,
    borderRadius: T.radius.lg, padding: T.space.md, marginBottom: T.space.sm,
  },
  label: { color: T.color.textSecondary, fontSize: T.font.sm },
  value: { color: T.color.textMuted, fontSize: T.font.sm },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
});

/* ═══════════════════════════════════════════════════════════
   ESTILOS — Main App (main)
═══════════════════════════════════════════════════════════ */
const main = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.color.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: T.space.lg, paddingTop: Platform.OS === 'ios' ? 52 : 14, paddingBottom: T.space.sm,
    backgroundColor: T.color.bg, borderBottomWidth: 1, borderBottomColor: T.color.border,
  },
  logo:       { color: '#fff', fontSize: T.font.xl, fontWeight: T.font.black, letterSpacing: -0.5 },
  logoAccent: { fontWeight: T.font.black },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  headerBtn:   { padding: T.space.xs },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: T.font.sm, fontWeight: T.font.bold },
  tabBar: {
    flexDirection: 'row', backgroundColor: T.color.surface,
    borderTopWidth: 1, borderTopColor: T.color.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 6, paddingTop: 6,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative', paddingTop: 6 },
  tabIndicator: { position: 'absolute', top: 0, left: '25%', right: '25%', height: 2, borderRadius: 1 },
  tabLabel: { color: T.color.textMuted, fontSize: T.font.xs, marginTop: 3, fontWeight: T.font.medium },
});

/* ═══════════════════════════════════════════════════════════
   ESTILOS — Splash (sp)
═══════════════════════════════════════════════════════════ */
const sp = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070F', alignItems: 'center', justifyContent: 'center' },
  bgOrb1: { position: 'absolute', width: 340, height: 340, borderRadius: 170, backgroundColor: 'rgba(229,9,20,0.06)', top: -60, left: -80 },
  bgOrb2: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(108,99,255,0.05)', bottom: -40, right: -60 },
  center: { alignItems: 'center' },
  logoGlow: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(229,9,20,0.14)',
  },
  ring: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 1.5, borderColor: 'rgba(229,9,20,0.4)',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    position: 'absolute',
  },
  ringDot1: { position: 'absolute', top: 6, left: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E50914' },
  ringDot2: { position: 'absolute', bottom: 6, right: 6, width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(229,9,20,0.5)' },
  logoCore: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: T.color.surface, borderWidth: 1, borderColor: 'rgba(229,9,20,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoN: { color: '#E50914', fontSize: 42, fontWeight: '900', fontStyle: 'italic' },
  title:  { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 4, marginTop: 24 },
  accent: { color: '#E50914' },
  sub: { color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 4, fontWeight: '600', marginTop: 6, marginBottom: 28 },
  track: { width: 180, height: 2, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 1, overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: '#E50914', borderRadius: 1 },
  loadTxt: { color: 'rgba(255,255,255,0.25)', fontSize: 10, letterSpacing: 2.5, marginTop: 12 },
});
