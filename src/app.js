/* Gaza displacement flow map: one phase at a time, data from data/data.csv.
   English by default; ?lang=ar shows the Arabic version. */

var LANG = /[?&]lang=ar\b/.test(location.search) ? 'ar' : 'en';

var T = {
  en: {
    title: 'Displacement movements inside the Gaza Strip',
    pageTitle: 'Gaza Displacement Map',
    phase: 'Phase',
    note: function (total, flows) { return fmt(total) + ' reported displacements along ' + fmt(flows) + ' recorded routes.'; },
    hint: 'Click a point to show only its routes. Click the map or press Esc to show all.',
    from: 'From', to: 'To', count: 'Reported displacements', households: 'households', date: 'Date',
    unknown: 'Unknown',
    origin: 'Place of origin', destination: 'Destination',
    perRoute: 'Reported displacements per route:',
    breaks: ['500 or fewer', '501 – 5,000', '5,001 – 50,000', 'More than 50,000'],
    coordLine: 'Yellow line (coordination line, 12 March 2026)',
    yellowArea: 'Yellow line area (ongoing military presence)',
    zones: 'Militarized zones and areas under displacement orders',
    source: 'Source: IOM Needs and Population Monitoring (NPM), Occupied Palestinian Territory; data published on ArcGIS Online.',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  },
  ar: {
    title: 'حركة النزوح داخل قطاع غزة',
    pageTitle: 'خريطة النزوح في غزة',
    phase: 'المرحلة',
    note: function (total, flows) { return fmt(total) + ' حالة نزوح مُبلَّغ عنها، في ' + fmt(flows) + ' مسارًا مرصودًا.'; },
    hint: 'اضغط على نقطة لإظهار مساراتها فقط. اضغط على الخريطة أو مفتاح Esc لإظهار الكل.',
    from: 'من', to: 'إلى', count: 'حالات النزوح المُبلَّغ عنها', households: 'أسرة', date: 'التاريخ',
    unknown: 'غير معروف',
    origin: 'مكان النزوح', destination: 'وجهة النزوح',
    perRoute: 'عدد حالات النزوح في كل مسار:',
    breaks: ['500 أو أقل', '501 – 5,000', '5,001 – 50,000', 'أكثر من 50,000'],
    coordLine: 'الخط الأصفر (خط التنسيق، 12 مارس 2026)',
    yellowArea: 'منطقة الخط الأصفر (وجود عسكري مستمر)',
    zones: 'مناطق عسكرية وتحت أوامر إخلاء',
    source: 'المصدر: برنامج رصد الاحتياجات والسكان (NPM) التابع للمنظمة الدولية للهجرة في الأرض الفلسطينية المحتلة، منشورة على ArcGIS Online.',
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  }
}[LANG];

document.documentElement.lang = LANG;
document.documentElement.style.setProperty('--dir', LANG === 'ar' ? 'rtl' : 'ltr');
document.title = T.pageTitle;

var PHASE_COUNT = 6;

// The yellow line and militarized-zone layers date from 2026, so they are shown only with this phase
var PHASE_2026 = 6;

var BREAKS = [
  { min: 0, max: 500, color: '#ffb81c', shadow: '#fee8c8', width: 1 },
  { min: 501, max: 5000, color: '#ff671f', shadow: '#fdbb84', width: 2 },
  { min: 5001, max: 50000, color: '#d22630', shadow: '#e34a33', width: 4 },
  { min: 50001, max: 10000000, color: '#7a0019', shadow: '#d22630', width: 7 }
];

var map = L.map('map');
if (L.Browser.mobile) {
  map.setView([31.42, 34.38], 10);
} else {
  map.setView([31.42, 34.38], 11);
}

L.esri.basemapLayer('Gray').addTo(map);

function fetchGeoJson(url, options) {
  return fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (data) { return L.geoJSON(data, options); });
}

fetchGeoJson('./data/governorates.geojson', {
  style: { color: 'gray', weight: 1, dashArray: '2, 3', fill: false },
  onEachFeature: function (feature, layer) {
    layer.bindTooltip(feature.properties.Name, { permanent: true, direction: 'center', className: 'gov-label', opacity: 0.7 });
  }
}).then(function (l) { l.addTo(map); });

var layers2026 = L.layerGroup();
Promise.all([
  fetchGeoJson('./data/militarized_zones.geojson', { style: { color: '#8c2d04', weight: 0.5, fillColor: '#d94801', fillOpacity: 0.12 } }),
  fetchGeoJson('./data/yellow_line_area.geojson', { style: { color: '#e6b800', weight: 0.5, fillColor: '#ffd700', fillOpacity: 0.25 } }),
  fetchGeoJson('./data/coordination_line.geojson', { style: { color: '#f2c200', weight: 3 } })
]).then(function (ls) {
  ls.forEach(function (l) { layers2026.addLayer(l); });
});

var allRows = [];
var flowLayer = null;
var greyLayer = null;
var POINT_STYLE = {
  origin: { radius: 4, weight: 1, color: '#fff', fillColor: 'rgb(255, 103, 31)', fillOpacity: 0.9, opacity: 1 },
  destination: { radius: 3, weight: 0.5, color: 'rgb(17, 142, 170)', fillColor: 'rgb(0, 51, 160)', fillOpacity: 0.8, opacity: 1 },
  grey: { radius: 3, weight: 0.5, color: '#999', fillColor: '#bbb', fillOpacity: 0.6, opacity: 0.6 }
};

// The flow layer writes its own fields into feature properties, so each layer gets its own copies
function toFeatureCollection(rows) {
  return {
    type: 'FeatureCollection',
    features: rows.map(function (r) {
      return { type: 'Feature', geometry: { type: 'Point', coordinates: [r.s_lon, r.s_lat] }, properties: Object.assign({}, r) };
    })
  };
}

var FLOW_IDS = {
  originUniqueIdField: 's_id',
  originGeometry: { x: 's_lon', y: 's_lat' },
  destinationUniqueIdField: 'e_id',
  destinationGeometry: { x: 'e_lon', y: 'e_lat' }
};

// Clicking a point keeps only its routes in colour; every other route and point turns grey
function highlight(selected) {
  if (!selected.length || !flowLayer) return;
  var sIds = {}, eIds = {};
  selected.forEach(function (f) { sIds[f.properties.s_id] = true; eIds[f.properties.e_id] = true; });
  if (!map.hasLayer(greyLayer)) {
    greyLayer.addTo(map);
    greyLayer.bringToBack();
  }
  flowLayer.selectFeaturesForPathDisplay(selected, 'SELECTION_NEW');
  flowLayer.eachLayer(function (l) {
    var p = l.feature.properties;
    var on = p.isOrigin ? sIds[p.s_id] : eIds[p.e_id];
    l.setStyle(on ? (p.isOrigin ? POINT_STYLE.origin : POINT_STYLE.destination) : POINT_STYLE.grey);
    if (on) l.bringToFront();
  });
}

function resetHighlight() {
  if (!flowLayer || !greyLayer || !map.hasLayer(greyLayer)) return;
  map.removeLayer(greyLayer);
  flowLayer.selectAllFeaturesForPathDisplay();
  flowLayer.eachLayer(function (l) {
    l.setStyle(l.feature.properties.isOrigin ? POINT_STYLE.origin : POINT_STYLE.destination);
  });
}

map.on('click', resetHighlight);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') resetHighlight(); });

function fmt(n) { return Number(n).toLocaleString('en'); }

// '2025-01-27' -> '27 Jan 2025'
function fmtDate(iso) {
  var p = String(iso).split('-');
  return Number(p[2]) + ' ' + T.months[Number(p[1]) - 1] + ' ' + p[0];
}

// Phase labels come from the first and last dates in the data
function phaseLabel(phase) {
  var dates = allRows.filter(function (r) { return r.phase === phase; }).map(function (r) { return r.date; }).sort();
  if (!dates.length) return T.phase + ' ' + phase;
  return T.phase + ' ' + phase + ': ' + fmtDate(dates[0]) + ' – ' + fmtDate(dates[dates.length - 1]);
}

function place(name, gov) {
  if (!name || name === 'Unknown') return T.unknown;
  return gov && gov !== 'Unknown' && gov !== name ? name + ' (' + gov + ')' : name;
}

function bindTooltip(feature, layer) {
  var p = feature.properties;
  var from = '<b>' + T.from + ':</b> ' + place(p.s_name, p.s_gov);
  var to = '<b>' + T.to + ':</b> ' + place(p.e_name, p.e_gov);
  var text = p.isOrigin ? from + '<br/>' + to : to + '<br/>' + from;
  text += '<br/><b>' + T.count + ':</b> ' + fmt(p.movements);
  if (p.households) text += ' (' + fmt(p.households) + ' ' + T.households + ')';
  text += '<br/><b>' + T.date + ':</b> ' + fmtDate(p.date);
  layer.bindTooltip(text);
}

function showPhase(phase) {
  if (flowLayer) {
    flowLayer.stopAnimation();
    map.removeLayer(flowLayer);
    flowLayer = null;
  }
  if (greyLayer) {
    map.removeLayer(greyLayer);
    greyLayer = null;
  }
  if (phase === PHASE_2026) {
    layers2026.addTo(map);
  } else {
    map.removeLayer(layers2026);
  }
  document.getElementById('legend-2026').style.display = phase === PHASE_2026 ? 'block' : 'none';

  var rows = allRows.filter(function (r) { return r.phase === phase; });
  var total = rows.reduce(function (a, r) { return a + r.movements; }, 0);

  // Grey copy of every route, shown underneath while a point is selected
  greyLayer = L.canvasFlowmapLayer(toFeatureCollection(rows), {
    originAndDestinationFieldIds: FLOW_IDS,
    style: function () { return { radius: 0, weight: 0, opacity: 0, fillOpacity: 0, interactive: false }; },
    canvasBezierStyle: {
      type: 'simple',
      symbol: { strokeStyle: 'rgba(140, 140, 140, 0.45)', lineWidth: 1, lineCap: 'round', shadowColor: 'rgba(0, 0, 0, 0)', shadowBlur: 0 }
    },
    pathDisplayMode: 'all',
    animationStarted: false
  });

  flowLayer = L.canvasFlowmapLayer(toFeatureCollection(rows), {
    originAndDestinationFieldIds: FLOW_IDS,
    style: function (f) {
      return f.properties.isOrigin ? POINT_STYLE.origin : POINT_STYLE.destination;
    },
    canvasBezierStyle: {
      type: 'classBreaks',
      field: 'movements',
      classBreakInfos: BREAKS.map(function (b) {
        return {
          classMinValue: b.min,
          classMaxValue: b.max,
          symbol: { strokeStyle: b.color, lineWidth: b.width, lineCap: 'round', shadowColor: b.shadow, shadowBlur: 2.0 }
        };
      }),
      defaultSymbol: { strokeStyle: '#e7e1ef', lineWidth: 0.5, lineCap: 'round', shadowColor: '#e7e1ef', shadowBlur: 1.5 }
    },
    pathDisplayMode: 'all',
    animationStarted: true,
    animationEasingFamily: 'Linear',
    animationEasingType: 'None',
    animationDuration: 2000,
    onEachFeature: bindTooltip
  }).addTo(map);

  flowLayer.on('click', function (e) {
    L.DomEvent.stopPropagation(e);
    highlight(e.sharedOriginFeatures.length ? e.sharedOriginFeatures : e.sharedDestinationFeatures);
  });

  // Zoom to the phase's flows, keeping them clear of the title panel (right) and legend (left)
  var bounds = L.latLngBounds([]);
  rows.forEach(function (r) { bounds.extend([r.s_lat, r.s_lon]); bounds.extend([r.e_lat, r.e_lon]); });
  if (bounds.isValid()) {
    var wide = window.innerWidth > 900;
    map.fitBounds(bounds, {
      paddingTopLeft: [wide ? 240 : 20, 20],
      paddingBottomRight: [wide ? 340 : 20, 20],
      maxZoom: 13
    });
  }

  document.querySelectorAll('.phases button').forEach(function (b) {
    b.classList.toggle('active', Number(b.dataset.phase) === phase);
  });
  document.getElementById('phase-note').textContent = T.note(total, rows.length);
}

// Title and phase selector (buttons are filled in once the data has loaded)
var title = L.control({ position: 'topright' });
title.onAdd = function () {
  var div = L.DomUtil.create('div', 'panel title');
  div.innerHTML =
    '<h1>' + T.title + '</h1>' +
    '<div class="phases" id="phases"></div>' +
    '<div class="phase-note" id="phase-note"></div>' +
    '<div class="phase-note hint">' + T.hint + '</div>';
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  div.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-phase]');
    if (b) showPhase(Number(b.dataset.phase));
  });
  return div;
};
title.addTo(map);

// Legend
var legend = L.control({ position: 'bottomleft' });
legend.onAdd = function () {
  var div = L.DomUtil.create('div', 'panel legend');
  var breakRows = BREAKS.map(function (b, i) {
    return '<div class="row"><span class="bar" style="height:' + Math.max(b.width, 2) + 'px;background:' + b.color + '"></span><b>' + T.breaks[i] + '</b></div>';
  }).join('');
  div.innerHTML =
    '<div class="row"><span class="dot" style="background:rgb(255,103,31)"></span><b>' + T.origin + '</b></div>' +
    '<div class="row"><span class="dot" style="background:rgb(0,51,160)"></span><b>' + T.destination + '</b></div>' +
    '<div style="margin-top:6px">' + T.perRoute + '</div>' +
    breakRows +
    '<div id="legend-2026" style="display:none">' +
    '<div class="row" style="margin-top:6px"><span class="bar" style="height:3px;background:#f2c200"></span>' + T.coordLine + '</div>' +
    '<div class="row"><span class="swatch" style="background:rgba(255,215,0,0.35);border:1px solid #e6b800"></span>' + T.yellowArea + '</div>' +
    '<div class="row"><span class="swatch" style="background:rgba(217,72,1,0.15);border:1px solid #8c2d04"></span>' + T.zones + '</div>' +
    '</div>' +
    '<div class="source">' + T.source + '</div>';
  return div;
};
legend.addTo(map);

Papa.parse('./data/data.csv', {
  download: true,
  header: true,
  dynamicTyping: true,
  skipEmptyLines: true,
  complete: function (results) {
    allRows = results.data;
    var buttons = '';
    for (var k = 1; k <= PHASE_COUNT; k++) {
      buttons += '<button type="button" data-phase="' + k + '">' + phaseLabel(k) + '</button>';
    }
    document.getElementById('phases').innerHTML = buttons;
    showPhase(1);
  }
});
