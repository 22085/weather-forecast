console.clear();

// 当前天气源
let currentSource = 'seniverse'; // 'seniverse' 或 'openmeteo'

// 心知天气配置（你的密钥）
const UID = "PC7EcgQm4VQ0h5z4D";
const KEY = "S9AqXU-r59aXDCqGD";
const NOW_API = "https://api.seniverse.com/v3/weather/now.json";
const DAILY_API = "https://api.seniverse.com/v3/weather/daily.json";

// 高德地图 Key
const AMapKey = "7a60847e1def287410455534dcbfcd1d";

let LOCATION = "";

// 切换按钮函数
function toggleWeatherSource() {
    currentSource = currentSource === 'seniverse' ? 'openmeteo' : 'seniverse';
    $('#currentSource').text(currentSource === 'seniverse' ? '当前：心知天气（国内）' : '当前：Open-Meteo（国际）');
    $('#toggleSource').text(currentSource === 'seniverse' ? '切换国际天气（Open-Meteo）' : '切换心知天气（国内）');
    
    if (LOCATION) loadWeather(LOCATION);
}

// 加载高德地图并自动定位城市
function loadAMapAndStart() {
    AMapLoader.load({
        key: AMapKey,
        version: "2.0",
        plugins: ['AMap.Geocoder']
    }).then((AMap) => {
        navigator.geolocation.getCurrentPosition(pos => {
            const lng = pos.coords.longitude;
            const lat = pos.coords.latitude;
            new AMap.Geocoder().getAddress([lng, lat], (status, result) => {
                let city = "北京";
                if (status === 'complete' && result.regeocode) {
                    city = result.regeocode.addressComponent.city || result.regeocode.addressComponent.province || "北京";
                }
                LOCATION = city;
                loadWeather(city);
            });
        }, () => {
            LOCATION = "北京";
            loadWeather("北京");
        });
    }).catch(() => {
        LOCATION = "北京";
        loadWeather("北京");
    });
}

// 主天气加载函数
function loadWeather(location) {
    LOCATION = location.trim() || "北京";
    $('.city').text(LOCATION);
    updateBgImg($('.bg'));

    if (currentSource === 'seniverse') {
        loadSeniverse(LOCATION);
    } else {
        loadOpenMeteo(LOCATION);
    }
}

// 心知天气
function loadSeniverse(location) {
    const ts = Math.floor(Date.now() / 1000);
    const str = "ts=" + ts + "&uid=" + UID;
    const sig = encodeURIComponent(CryptoJS.HmacSHA1(str, KEY).toString(CryptoJS.enc.Base64));
    const params = str + "&sig=" + sig;

    // 实时
    const nowUrl = `${NOW_API}?location=${encodeURIComponent(location)}&${params}&callback=renderSeniverseNow`;
    // 预报
    const dailyUrl = `${DAILY_API}?location=${encodeURIComponent(location)}&${params}&callback=renderSeniverseDaily`;

    $('body').append(`<script src="${nowUrl}"></script>`);
    $('body').append(`<script src="${dailyUrl}"></script>`);
}

// Open-Meteo（全球）
function loadOpenMeteo(location) {
    fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=zh`)
        .then(r => r.json())
        .then(geo => {
            let lat = 39.9042, lng = 116.4074; // 默认北京
            let cityName = location;
            if (geo.results && geo.results[0]) {
                lat = geo.results[0].latitude;
                lng = geo.results[0].longitude;
                cityName = geo.results[0].name + (geo.results[0].country ? ', ' + geo.results[0].country : '');
            }
            $('.city').text(cityName);

            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`;
            fetch(url)
                .then(r => r.json())
                .then(data => {
                    renderOpenMeteoNow(data);
                    renderOpenMeteoDaily(data);
                });
        });
}

// 渲染：心知实时
function renderSeniverseNow(data) {
    const info = data.results[0];
    const now = info.now;
    $('.currentTemp').text(now.temperature + '°');
    $('.desc').text(now.text);
    $('.currentWeatherImg img').attr('src', 'images/' + now.code + '.png');
    updateTime();
}

// 渲染：心知预报
function renderSeniverseDaily(data) {
    const daily = data.results[0].daily;
    $('.future').each(function(i) {
        if (i < 3) {
            const d = daily[i];
            $(this).find('.date').text(getWeekDay(d.date));
            $(this).find('.desc').text(d.text_day);
            $(this).find('img').attr('src', 'images/' + d.code_day + '.png');
            $(this).find('.temp').text(d.low + '°~' + d.high + '°');
        }
    });
    $('.wind').text(daily[0].wind_direction + '风 ' + daily[0].wind_scale + '级');
}

// 渲染：Open-Meteo 实时
function renderOpenMeteoNow(data) {
    const c = data.current;
    const descMap = {0:'晴',1:'少云',2:'多云',3:'阴',45:'雾',51:'小雨',53:'中雨',55:'大雨',61:'小雨',63:'雨',65:'大雨',71:'小雪',73:'雪',75:'大雪',80:'阵雨',95:'雷阵雨'};
    const desc = descMap[c.weather_code] || '多云';
    $('.currentTemp').text(Math.round(c.temperature_2m) + '°');
    $('.desc').text(desc);
    $('.wind').text('风速 ' + Math.round(c.wind_speed_10m) + ' km/h');
    $('.currentWeatherImg img').attr('src', 'images/' + (c.weather_code < 10 ? '0' + c.weather_code : c.weather_code) + '.png');
    updateTime();
}

// 渲染：Open-Meteo 预报
function renderOpenMeteoDaily(data) {
    const descMap = {0:'晴',1:'少云',2:'多云',3:'阴',45:'雾',51:'小雨',61:'雨',71:'雪',80:'阵雨',95:'雷阵雨'};
    data.daily.time.slice(0,3).forEach((date, i) => {
        const el = $('.future').eq(i);
        const code = data.daily.weather_code[i];
        el.find('.date').text(getWeekDay(date));
        el.find('.desc').text(descMap[code] || '多云');
        el.find('.temp').text(Math.round(data.daily.temperature_2m_min[i]) + '°~' + Math.round(data.daily.temperature_2m_max[i]) + '°');
        el.find('img').attr('src', 'images/' + (code < 10 ? '0' + code : code) + '.png');
    });
}

// 星期
function getWeekDay(dateStr) {
    const week = ['日','一','二','三','四','五','六'];
    return '星期' + week[new Date(dateStr).getDay()];
}

// 时间
function updateTime() {
    const now = new Date();
    let h = now.getHours() % 12 || 12;
    h = h < 10 ? '0' + h : h;
    const m = now.getMinutes() < 10 ? '0' + now.getMinutes() : now.getMinutes();
    $('.time').text(h + ':' + m + (now.getHours() >= 12 ? ' pm' : ' am'));
    setTimeout(updateTime, 30000);
}

// 背景图
function updateBgImg(el) {
    el.css('background-image', `url(https://picsum.photos/1000/800/?random&t=${Math.random()})`);
}

// 搜索
$('input').on('keydown', e => {
    if (e.keyCode === 13) {
        const val = $('input').val().trim();
        if (val) loadWeather(val);
        $('input').val('').blur();
    }
});

// 启动
$(() => {
    updateBgImg($('.bg'));
    loadAMapAndStart();
});
