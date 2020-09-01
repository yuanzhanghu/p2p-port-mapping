/*
 * _postinstall.js is a script that runs automatically after the `npm install`
 */
// Get platform from node
var os = require('os');
var platform = os.platform();
var arch = os.arch();
// Call child process and execute
var exec = require('child_process').exec;

let cmdstr = ''
if (platform === 'darwin' || platform == 'linux') {
    cmdstr = `cp ./pre-built/${platform}_wrtc/* ./node_modules/wrtc/build/Release/`
} else if (platform === 'win32') {
    cmdstr = `copy .\\pre-built\\${platform}_wrtc\\* .\\node_modules\\wrtc\\build\\Release /y`
}

if (arch === 'x64') {
    exec(cmdstr, function (error, stdout, stderr) {
        console.log(stdout)
        if (error !== null) {
            console.error(error)
        } else {
            console.log('copied pre-built wrtc binary.')
        }
    })
}