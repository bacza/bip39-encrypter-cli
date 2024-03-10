#!/usr/bin/env node

import chalk from 'chalk';
import fig from 'figures';
import { input, password, select } from '@inquirer/prompts';
import autocomplete from 'inquirer-autocomplete-standalone';
import { Encrypter, WORDS } from 'bip39-encrypter';
import pkg from '../package.json';

const CLEAR_PROMPT = { clearPromptOnDone: true };

const COLOR = chalk.cyan;

function findWords(input: string) {
  return WORDS.filter((word) => word.startsWith(input));
}

async function getEncrypter() {
  const digits = await select({
    message: 'Select encryption method:',
    choices: [
      { name: 'Word to number (4 digits)', value: 4 },
      { name: 'Word to number (5 digits)', value: 5 },
      { name: 'Word to number (6 digits)', value: 6 },
    ],
  });

  while (true) {
    const pass1 = await password(
      {
        message: 'Enter encryption password:',
        mask: true,
        validate: (value) => {
          try {
            new Encrypter(value, digits);
            return true;
          } catch (error: any) {
            return error.message;
          }
        },
      },
      CLEAR_PROMPT
    );

    const pass2 = await password(
      {
        message: 'Confirm encryption password:',
        mask: true,
      },
      CLEAR_PROMPT
    );

    if (pass1 != pass2) {
      console.log(chalk.red(fig.cross), 'Passwords mismatch!');
      continue;
    }

    const showPassword = await select(
      {
        message: 'Passwords match. Continue?',
        choices: [
          { name: 'Yes', value: false },
          { name: 'No, show the password', value: true },
        ],
      },
      CLEAR_PROMPT
    );

    if (showPassword) {
      const isPasswordOK = await select(
        {
          message: `The password is: ${COLOR(pass1)}. Continue?`,
          choices: [
            { name: 'Yes', value: true },
            { name: 'No, reenter the password', value: false },
          ],
        },
        CLEAR_PROMPT
      );

      if (!isPasswordOK) continue;
    }

    return new Encrypter(pass1, digits);
  }
}

function getWordChoices(isLast: boolean) {
  return isLast
    ? [
        { name: 'Done', value: 'd' },
        { name: 'Retry word', value: 'r' },
      ]
    : [
        { name: 'Next word', value: 'n' },
        { name: 'Retry word', value: 'r' },
        { name: 'Cancel', value: 'q' },
      ];
}

async function encrypt(enc: Encrypter, length: number) {
  for (let n = 0; n < length; n++) {
    const isLast = n + 1 >= length;
    const num = `#${n + 1}`;

    const word = await autocomplete(
      {
        message: `Enter word ${COLOR(num)}:`,
        source: async (input) =>
          findWords(input || '').map((word) => ({ value: word })),
      },
      CLEAR_PROMPT
    );

    const encrypted = enc.encryptWord(word, n);

    const sel = await select(
      {
        message: `Word ${COLOR(num)}: ${COLOR(word)}, encrypted: ${COLOR(
          encrypted
        )}. Continue?`,
        choices: getWordChoices(isLast),
      },
      CLEAR_PROMPT
    );

    if (sel === 'd') return true;
    if (sel === 'q') return false;
    if (sel === 'r') n--;
  }
}

async function decrypt(enc: Encrypter, length: number) {
  for (let n = 0; n < length; n++) {
    const isLast = n + 1 >= length;
    const num = `#${n + 1}`;

    const encrypted = await input(
      {
        message: `Enter encrypted word ${COLOR(num)}:`,
        validate: (value) => {
          try {
            enc.decryptWord(value, n);
            return true;
          } catch (error: any) {
            return error.message;
          }
        },
      },
      CLEAR_PROMPT
    );

    const decrypted = enc.decryptWord(encrypted, n);

    const sel = await select(
      {
        message: `Word ${COLOR(num)}: ${COLOR(encrypted)}, decrypted: ${COLOR(
          decrypted
        )}. Continue?`,
        choices: getWordChoices(isLast),
      },
      CLEAR_PROMPT
    );

    if (sel === 'd') return true;
    if (sel === 'q') return false;
    if (sel === 'r') n--;
  }
}

async function main() {
  console.log('\n%s %s v%s.\n', chalk.green('*'), pkg.description, pkg.version);

  const encryption = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Encrypt recovery phrase', value: true },
      { name: 'Decrypt recovery phrase', value: false },
    ],
  });

  const length = await select({
    message: 'How long is your recovery phrase?',
    choices: [
      { name: '12 words', value: 12 },
      { name: '24 words', value: 24 },
    ],
  });

  const enc = await getEncrypter();

  const handler = encryption ? encrypt : decrypt;
  return handler(enc, length);
}

main()
  .then(() => {
    console.log(chalk.green(fig.tick), 'Done.');
    process.exit(0);
  })
  .catch(() => {
    console.log(chalk.red(fig.cross), 'Failed!');
    process.exit(1);
  });
