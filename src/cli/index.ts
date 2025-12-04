#!/usr/bin/env tsx

import { Command } from 'commander'
import { version } from '../../package.json'
import { sendTestEventCommand } from './commands/send-test-event'

const program = new Command()

program.name('libi').description('CLI para gestionar la aplicación Libi').version(version)

// Registrar comandos
program.addCommand(sendTestEventCommand)

program.parse(process.argv)
