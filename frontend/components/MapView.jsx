'use client';
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { STATUS_COLOR, CATEGORIES } from '@/lib/constants';

export const DEFAULT_CENTER = (process.env.NEXT_PUBLIC_DEFAULT_CENTER || '40.7128,-74.0060').split(',').map(Number);

/** mode: 'markers' (clustered, status-coloured) | 'heat' (weighted heatmap) | 'pick' (tap to place one pin) */
export default function MapView({ points = [], mode = 'markers', value, onPick, onSelect, selectedId, height = 420, className = '' }) {
  const el = useRef(null);
  const S = useRef({});
  const cb = useRef({});
  cb.current = { onPick, onSelect };
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      const L = (await import('leaflet')).default;
      window.L = L;
      await import('leaflet.markercluster');
      await import('leaflet.heat');
      if (dead || !el.current) return;
      const map = L.map(el.current, { maxZoom: 19 }).setView(value ? [value.lat, value.lng] : DEFAULT_CENTER, value ? 17 : 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }).addTo(map);
      if (mode === 'pick') map.on('click', (e) => cb.current.onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      S.current = { L, map, fitted: false };
      setReady(true);
    })();
    return () => { dead = true; S.current.map?.remove(); S.current = {}; setReady(false); };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const { L, map } = S.current;
    if (!ready || !map) return;
    S.current.layer?.remove();
    let layer;
    const pin = (color, sel) => L.divIcon({ className: '', html: `<span class="cf-pin ${sel ? 'sel' : ''}" style="background:${color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 18] });

    if (mode === 'heat') {
      layer = L.heatLayer(points.map((p) => [p.lat, p.lng, Math.max(0.2, p.weight)]), { radius: 30, blur: 24, maxZoom: 16, gradient: { 0.3: '#F2B705', 0.6: '#E8590C', 1: '#B83A26' } });
    } else if (mode === 'pick') {
      if (value) layer = L.marker([value.lat, value.lng], { icon: pin('#B83A26', true), draggable: true })
        .on('dragend', (e) => { const p = e.target.getLatLng(); cb.current.onPick?.({ lat: p.lat, lng: p.lng }); });
    } else {
      layer = L.markerClusterGroup({ maxClusterRadius: 45, showCoverageOnHover: false });
      points.forEach((p) => {
        const m = L.marker([p.lat, p.lng], { icon: pin(STATUS_COLOR[p.status] || '#444', p.id === selectedId), title: p.title });
        m.bindTooltip(`<b>${p.title.replace(/</g, '&lt;')}</b><br>${CATEGORIES[p.category] || ''} · ${p.status}`);
        m.on('click', () => cb.current.onSelect?.(p));
        layer.addLayer(m);
      });
    }
    if (layer) { layer.addTo(map); S.current.layer = layer; }
    if (mode !== 'pick' && points.length && !S.current.fitted) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])).pad(0.2), { maxZoom: 15 });
      S.current.fitted = true;
    }
    if (mode === 'pick' && value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 16));
  }, [ready, points, mode, value, selectedId]);

  return <div ref={el} style={{ height }} className={`z-0 w-full overflow-hidden rounded-lg border border-line bg-[#e8ebe3] ${className}`} role="application" aria-label="Map" />;
}
