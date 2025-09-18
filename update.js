// TODO: convert some markdown to html

import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import fs from 'fs';

const gameid = "1280770";
const websiteURL = "https://jamescc10.github.io/rmclans/output/";
const leaderboards = [
    ["7278576", "Deaths"],
    ["7278567", "Level"],
    ["7278569", "Free for all losses"],
    ["7278568", "Free for all wins"],
    ["7278574", "Kills"],
    ["8917861", "King of the hill losses"],
    ["8917858", "King of the hill wins"],
    ["7605131", "Melee kills"],
    ["8046038", "No scopes"],
    ["7278572", "Team deathmatch losses"],
    ["7278570", "Team deathmatch wins"],
    ["7278578", "World deaths"]
];

const getLeaderboardData = async (url, lb) => {
    const steamurl = `${url}stats/${gameid}/achievements/?tab=leaderboards&lb=${lb}`;
    const res = await fetch(steamurl);
    const body = await res.text();
    const $ = cheerio.load(body);
    let data = {};

    $('a').each((index, element) => {
        const href = $(element).attr("href");
        if(href) {
            if(href.startsWith(`${url}stats/${gameid}/`)) {
                const score = $(element).parent().parent().parent().children(".scoreh").text().trim();
                const rank = $(element).parent().parent().parent().children(".globalRankh").text().trim();
                data = {
                    score: score,
                    rank: rank.slice(13,rank.length)
                };
            }
        }
    });

    return data;
}

const urlToData = async (url) => {
    // add ending / to url
    url = (url[url.length-1] == "/") ? url : url.padEnd(url.length+1,"/");

    // get leaderboard data for everything
    let data = {};
    data.score = new Array();
    for(let i = 0; i < leaderboards.length; ++i) {
        let d = await getLeaderboardData(url, leaderboards[i][0]);
        if(d.score != undefined) {
            data.score.push([leaderboards[i][1], d.rank, d.score]);
        } else {
            data.score.push([leaderboards[i][1], "N/A", "N/A"]);
        }
    }

    return data;
}

const playersData = async (inputJson) => {
    let playersData = []; // kills latest,kills week, kills 2week,kills month
    let playersInfo = []; // [name, url, id, clan, public]

    for(const player of inputJson.players) {
        if(!player.public) {
            // private
            playersData.push({});
            playersInfo.push(player);
        } else {
            // public
            let json = await urlToData(player.url);
            let oldDataFetch = await fetch(`${websiteURL}players/${player.id}.json`);
            let oldData = {
                kills_latest: undefined,
                kills_week: undefined,
                kills_2week: undefined,
                kills_month: undefined
            };
            if(oldDataFetch.ok)
                oldData = JSON.parse(await oldDataFetch.text());

            json.kills_latest = Number(json.score[4][2].replace(/,/g, ''));
            json.kills_week = oldData.kills_latest;
            json.kills_2week = oldData.kills_week;
            json.kills_month = oldData.kills_2week;

            playersData.push(json);
            playersInfo.push(player);
        }
    }

    return [playersInfo, playersData];
}

const clansData = async (inputJson, playerData) => {
    let clanData = []; // kills latest, kills week, kills 2week, kills month, requirements, players
    let clanInfo = []; // [title, info]

    for(const clan of inputJson.clans) {
        let json = {
            requirements: clan.requirements,
            players: clan.players
        }

        let oldDataFetch = await fetch(`${websiteURL}clans/${clan.title}.json`);
        let oldData = {
            kills_latest: undefined,
            kills_week: undefined,
            kills_2week: undefined,
            kills_month: undefined
        };
        if(oldDataFetch.ok)
            oldData = JSON.parse(await oldDataFetch.text());

        json.kills_week = oldData.kills_latest;
        json.kills_2week = oldData.kills_week;
        json.kills_month = oldData.kills_2week;
        json.kills_latest = 0;

        for(let i = 0; i < playerData[0].length; ++i) {
            const player =  playerData[1][i];

            if(playerData[0].public) {
                clan.kills_latest += player.kills_latest;
            }
        }

        clanInfo.push([clan.title, clan.info]);
        clanData.push(json);
    }

    return [clanInfo, clanData];
}

const run = async (now) => {
    const inputJson = JSON.parse(fs.readFileSync("./input.json"));

    const playerData = await playersData(inputJson);
    const clanData = await clansData(inputJson, playerData);

    // file system
    fs.rmSync("./static/data/", {recursive:true, force:true});
    fs.mkdirSync("./static/data/");
    fs.mkdirSync("./static/data/clans/");
    fs.mkdirSync("./static/data/players/");
    const outputPlayersJson = JSON.stringify(playerData[0]);
    const outputClansJson = JSON.stringify(clanData[0]);
    fs.writeFileSync("./static/data/clans.json", `{"clans": ${outputClansJson}}`);
    fs.writeFileSync("./static/data/players.json", `{"players": ${outputPlayersJson}}`);
    for(let i = 0; i < clanData[0].length; ++i) { fs.writeFileSync(`./static/data/clans/${clanData[0][i][0]}.json`, JSON.stringify(clanData[1][i])); }
    for(let i = 0; i < playerData[0].length; ++i) { fs.writeFileSync(`./static/data/players/${playerData[0][i].id}.json`, JSON.stringify(playerData[1][i])); }
    fs.writeFileSync("./static/data/time.txt", `${now}`);
}

const main = async () => {
    const now = new Date();
    if(now.getUTCDay() !== 5 || now.getUTCHours() !== 17) {
        console.log("not friday 5pm");
        return;
    }

    let oldTimeFetch = await fetch(`${websiteURL}time.txt`);
    let oldTime = now;
    if(oldTimeFetch.ok)
        oldTime = new Date(await oldDataFetch.text());
    else {
        console.log("first run?");
        run(now);
        return;
    }

    const differenceDays = (now-oldTime)/(1000*60*60*24);
    if(differenceDays >= 7) {
        console.log("running");
        run(now);
    } else {
        console.log(`its only been ${differenceDays}`);
    }
}

main();
