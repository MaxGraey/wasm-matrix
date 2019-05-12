// The entry file of your WebAssembly module.

// https://github.com/WebAssembly/WASI/issues/19

import "allocator/arena";
import "collector/itcm";
import {Console, Random, Date} from './wasa';

// Ansi Color Codes
let GREEN: string = "\u001b[32m";
let WHITE: string = "\u001b[37m";
let RESET: string = "\u001b[0m";

// Ansi Cursor Codes
let CTL_ESC: string = "\u001b["; 

// Matrix Characters
let CHARACTERS: string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()";

// https://github.com/AssemblyScript/assemblyscript/blob/master/std/assembly/env.ts
@global
export function wasiabort(
  message: string | null = "",
  fileName: string | null = "",
  lineNumber: u32 = 0,
  columnNumber: u32 = 0
): void {
  Console.log(message);
}

class Droplet {
  column: i32;
  row: i32;
  characterString: string;
  frameSkip: i32;
  currentFrame: i32;
  speed: i32;
  height: i32;
}

const droplets: Droplet[] = [];

function getTimeCounter(): i32 {
  return floor<f64>(Date.now() / 100000) as i32;
}

export function _start(): void {


  // Create all of our droplets
  for (let i = 0; i < 20; i++) {
    droplets.push(createDroplet(i));
  }

  let lastTime = getTimeCounter() - 5;

  while (true) {

    let currentTime: i32 = getTimeCounter();

    // See if it is time to update
    if (abs(lastTime - currentTime) < 1) {
      continue;
    }

    lastTime = currentTime;

    // Update our droplets
    for (let i = 0; i < droplets.length; i++) {
      updateDroplet(droplets[i]);
    }

    // Clear the screen
    flushConsole();

    // Draw the droplets
    for (let i = 0; i < droplets.length; i++) {
      drawDroplet(droplets[i]);
    }

    // Done!
  }
}

function printColor(value: string, color: string): void {
  Console.write(color + value + RESET, false);
}

function flushConsole(): void {
  Console.write("\u001b[2J", false)
}

function createDroplet(column: i32): Droplet {
  let droplet: Droplet = new Droplet();
  droplet.column = column;
  droplet.row = 0;
  droplet.height = (getRandomNumber() % 10) + 3;
  droplet.speed = (getRandomNumber() % 3) + 1;
  droplet.frameSkip = (getRandomNumber() % 2) + 1;

  droplet.characterString = "";
  for (let i = 0; i < droplet.height; i++) {
    droplet.characterString += getRandomCharacter();
  }

  return droplet;
}

function updateDroplet(droplet: Droplet): void {

  droplet.currentFrame++;

  if (droplet.currentFrame < droplet.frameSkip) {
    return;
  }

  droplet.currentFrame = 0;

  // Increase the droplet row
  droplet.row += droplet.speed;

  // Remove the the moved characters
  droplet.characterString = droplet.characterString.slice(droplet.speed, droplet.characterString.length);

  // pop on a new character
  for (let i = droplet.characterString.length; i < droplet.height; i++) {
    droplet.characterString += getRandomCharacter();
  }

}

function drawDroplet(droplet: Droplet): void {

  for(let i = 0; i < droplet.characterString.length; i++) {
    // Move the cursor to the correct position
    moveCursorToPosition(droplet.column, droplet.row + i);
    

    // Get our color
    let color: string = GREEN;
    if (i === droplet.characterString.length - 1) {
      color = WHITE;
    }

    // Draw the character
    printColor(droplet.characterString.slice(i, i + 1), color);
  }
}

// https://github.com/nojvek/matrix-rain/blob/master/ansi.js
function moveCursorToPosition(column: i32, row: i32): void {
  let cursorPosition: string = CTL_ESC + row.toString() + ";" + column.toString() + "H";
  Console.write(CTL_ESC + row.toString() + ";" + column.toString() + "H", false)
}

function getRandomNumber(): i32 {
  return Random.randomBytes(1)[0];
}

function getRandomCharacter(): string {
  let index: i32 = getRandomNumber() % CHARACTERS.length;
  let newCharacter: string = CHARACTERS.slice(index, index + 1);
  return newCharacter;
}