import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'

type Point = { lat: number; lon: number }

function ClickHandler({ onPick }: { onPick: (p: Point) => void }) {
  useMapEvents({
    click(e) {
      const lon = ((e.latlng.lng + 540) % 360) - 180 // normaliza si se dio la vuelta al mundo
      onPick({ lat: +e.latlng.lat.toFixed(4), lon: +lon.toFixed(4) })
    },
  })
  return null
}

function FlyTo({ point }: { point: Point }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([point.lat, point.lon], Math.max(map.getZoom(), 5), { duration: 0.6 })
  }, [map, point.lat, point.lon])
  return null
}

/** Mapa mundial: un clic elige cualquier punto del planeta. */
export function MapPicker({ point, second, onPick }: { point: Point; second?: Point | null; onPick: (p: Point) => void }) {
  return (
    <MapContainer center={[point.lat, point.lon]} zoom={4} className="map" worldCopyJump>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} />
      <FlyTo point={point} />
      <CircleMarker center={[point.lat, point.lon]} radius={9} pathOptions={{ color: '#1f5fbf', weight: 3 }} />
      {second && <CircleMarker center={[second.lat, second.lon]} radius={9} pathOptions={{ color: '#c2570a', weight: 3 }} />}
    </MapContainer>
  )
}
