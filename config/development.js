/**
 * Created by Roman on 11.02.2015.
 */

var path = require('path');

process.env.HOST = 'http://134.249.164.53:8830';
process.env.PORT = '8830';
//process.env.HOST = 'http://localhost:8830';
process.env.PLIVO_APP_ID = 14672593026521222;
//process.env.DB_HOST = 'localhost';
process.env.DB_HOST = '192.168.88.250';
//process.env.DB_NAME = "testStatistic";
//process.env.DB_USER = "user";
//process.env.DB_PASS = "1q2w3e!@#";
process.env.DB_NAME = "testCallNew";
process.env.DB_PORT = 27017;

process.env.REDIS_HOST = '134.249.164.53';
process.env.REDIS_PORT = 6379;

/*Plivo credentials*/
process.env.PLIVO_AUTH_ID = "MAYTRKODM5Y2ZINDVLOT";
process.env.PLIVO_AUTH_TOKEN = "ZDNhZjZmYTZiZWU3NzJjNGZkOWYyMmY0YTA3ZGZk";

/*Nexmo credentials*/
process.env.NEXMO_API_KEY = "42d19e9b";
process.env.NEXMO_API_SECRET = "36e5af51";

//ffmpeg:
//process.env.FFMPEG_DIR = path.join('C:', 'Program Files', 'ffmpeg', 'bin');
process.env.FFMPEG_DIR = path.join('/','usr', 'bin');
//process.env.FFMPEG_BIN = path.join(process.env.FFMPEG_DIR, 'ffmpeg.exe');
process.env.FFMPEG_BIN = path.join(process.env.FFMPEG_DIR, 'avconv');
//process.env.FFMPEG_PROBE = path.join(process.env.FFMPEG_DIR, 'ffprobe.exe');
process.env.FFMPEG_PROBE = path.join(process.env.FFMPEG_DIR, 'avprobe');

