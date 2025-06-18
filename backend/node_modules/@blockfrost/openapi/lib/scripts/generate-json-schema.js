"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../index");
const jsonSchema = (0, index_1.generateSchemas)();
console.log(JSON.stringify(jsonSchema));
