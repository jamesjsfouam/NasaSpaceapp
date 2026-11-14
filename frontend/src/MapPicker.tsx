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
    <MapContainer center={[point.lat, point.lon]} zoom={4} maxZoom={12} className="map" worldCopyJump>
      {/* Imagen satelital de la NASA (GIBS, Blue Marble). */}
      <TileLayer
        attribution='Imagen: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> Blue Marble'
        url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/2004-08-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg"
        maxNativeZoom={8}
        maxZoom={12}
      />
      <ClickHandler onPick={onPick} />
      <FlyTo point={point} />
      <CircleMarker center={[point.lat, point.lon]} radius={9} pathOptions={{ color: '#3fd0e6', weight: 3, fillOpacity: 0.35 }} />
      {second && <CircleMarker center={[second.lat, second.lon]} radius={9} pathOptions={{ color: '#f59e42', weight: 3, fillOpacity: 0.35 }} />}
    </MapContainer>
  )
}
