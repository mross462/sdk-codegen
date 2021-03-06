/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 Looker Data Sciences, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import * as OAS from 'openapi3-ts'
import md5 from 'blueimp-md5'
import { HttpMethod, ResponseMode, responseMode, StatusCode } from '../typescript/looker/rtl/transport'
import { IVersionInfo } from './codeGen'

export const strBody = 'body'
export const strRequest = 'Request'
export const strWrite = 'Write'
export declare type Arg = string

// handy refs
// https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#schema-object
// https://swagger.io/docs/specification/data-models/data-types/

/**
 * convert kebab-case or snake_case to camelCase
 * @param value string value to convert to camelCase
 */
export const camelCase = (value: string) => {
  return value.replace(/([-_][a-z])/ig, ($1) => {
    return $1.toUpperCase()
      .replace('-', '')
      .replace('_', '')
  })
}

export interface IModel {
}

/**
 * create a "searchable" string that can be concatenated to a larger search string
 * @param {string} value to search
 * @returns {string} value plus search delimiter
 */
const searchIt = (value: string) => value ? value + '\n' : ''

export interface ISymbol {
  name: string
  type: IType

  asHashString(): string

  searchString(criteria: SearchCriteria): string

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean

}

export type IKeyedCollection<T> = Record<string, T>
export type IMethodList = IKeyedCollection<IMethod>
export type ITypeList = IKeyedCollection<IType>
export type ITagList = IKeyedCollection<IMethodList>
export type IPropertyList = IKeyedCollection<IProperty>
export type IKeyList = Set<string>

/**
 * Returns sorted string array for IKeylist type
 * @param {IKeyList} keys Set of values
 * @returns {string[]} sorted string array of keys
 */
export const keyValues = (keys: IKeyList): string[] => {
  return Array.from(keys.values()).sort()
}

/**
 * Resolve a list of method keys into an IMethod[] in alphabetical order by name
 * @param {IApiModel} api model to use
 * @param {IKeyList} refs references to models
 * @returns {IMethod[]} Populated method list. Anything not matched is skipped
 */
export const methodRefs = (api: IApiModel, refs: IKeyList): IMethod[] => {
  const keys = keyValues(refs)
  const result: IMethod[] = []
  keys.forEach(k => {
    if (k in api.methods) {
      result.push(api.methods[k])
    }
  })
  return result
}

/**
 * Resolve a list of method keys into an IType[] in alphabetical order by name
 * @param {IApiModel} api model to use
 * @param {IKeyList} refs references to models
 * @returns {IMethod[]} Populated method list. Anything not matched is skipped
 */
export const typeRefs = (api: IApiModel, refs: IKeyList): IType[] => {
  const keys = keyValues(refs)
  const result: IType[] = []
  keys.forEach(k => {
    if (k in api.types) {
      result.push(api.types[k])
    }
  })
  return result
}

export interface ISymbolList {
  methods: IMethodList
  types: ITypeList
}

export enum SearchCriterion {
  method,
  type,
  name,
  description,
  argument,
  property,
  title,
  activityType,
  status,
  response,
}

export type SearchCriterionTerm = keyof typeof SearchCriterion

export type SearchCriteria = Set<SearchCriterion>

export const SearchAll: SearchCriteria = new Set([
  SearchCriterion.method,
  SearchCriterion.type,
  SearchCriterion.name,
  SearchCriterion.description,
  SearchCriterion.argument,
  SearchCriterion.property,
  SearchCriterion.title,
  SearchCriterion.activityType,
  SearchCriterion.status,
  SearchCriterion.response,
])

export const CriteriaToSet = (criteria: string[]): SearchCriteria => {
  let result: SearchCriteria = new Set()
  criteria.forEach(name => result.add(SearchCriterion[name.toLowerCase() as SearchCriterionTerm]))
  return result
}

export const SetToCriteria = (criteria: SearchCriteria): string[] => {
  let result: string[] = []
  criteria.forEach(value => result.push(SearchCriterion[value]))
  return result
}

export interface ISearchResult {
  tags: ITagList
  types: ITypeList
  message: string
}

export interface ISymbolTable extends ISymbolList {
  resolveType(schema: OAS.SchemaObject): IType
}

export interface IType {
  /**
   * Name of the type
   */
  name: string

  /**
   * key/value collection of properties for this type
   */
  properties: IPropertyList

  /**
   * List of writeable properties for this type
   */
  writeable: IProperty[]

  /**
   * Status like 'beta', 'experimental', 'stable'
   */
  status: string

  /**
   * If this type is a collection, this is the "item" type
   */
  elementType?: IType

  /**
   * True if this type is deprecated
   */
  deprecated: boolean

  /**
   * Description of the type
   */
  description: string

  /**
   * Title for the type. Dunno why OAS has this
   */
  title: string

  /**
   * Default value for the type. Optional types may have default values defined
   */
  default?: string

  /**
   * Is this a read-only type?
   */
  readOnly: boolean

  /**
   * Number of times this type is referenced, per language, when generating methods
   * Other than for reporting purposes, this is used to generate import statements
   * Idea adopted from Delphi
   */
  refCount: number

  /**
   * OAS schema for the type
   */
  schema: OAS.SchemaObject

  /**
   * If this is a custom type from the API specification, it will be eponymous
   * If it's a list type, it will be customType of the item type
   * Otherwise, it will be '' (e.g. IntrinsicType)
   */
  customType: string

  /**
   * names of methods referencing this type
   */
  methodRefs: IKeyList

  /**
   * Names of types referenced by this type
   */
  types: IKeyList

  /**
   * Names of custom types reference by this type
   */
  customTypes: IKeyList

  asHashString(): string

  isRecursive(): boolean

  searchString(criteria: SearchCriteria): string

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean

}

export declare type MethodParameterLocation = 'path' | 'body' | 'query' | 'header' | 'cookie'

export interface IParameter extends ISymbol {
  type: IType
  location: MethodParameterLocation
  required: boolean
  description: string

  asProperty(): IProperty

  asHashString(): string

  doEncode() : boolean

}

export interface IMethodResponse {
  statusCode: number
  mediaType: string
  type: IType
  mode: ResponseMode
  description: string

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean

  searchString(criteria: SearchCriteria): string
}

class MethodResponse implements IMethodResponse {

  constructor(
    public statusCode: number,
    public mediaType: string,
    public type: IType,
    public description: string) {
  }

  get mode() : ResponseMode {
    return responseMode(this.mediaType)
  }

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean {
    if (!criteria.has(SearchCriterion.response)) return false
    return rx.test(this.searchString(criteria)) || this.type.search(rx, criteria)
  }

  searchString(criteria: SearchCriteria): string {
    let result = searchIt(`${this.statusCode}`) + searchIt(`${ResponseMode[this.mode]}`)
    if (criteria.has(SearchCriterion.name)) result += searchIt(this.mediaType)
    if (criteria.has(SearchCriterion.type)) result += searchIt(this.mediaType)
    return result
  }

}

export interface IProperty extends ISymbol {
  required: boolean
  nullable: boolean
  description: string
  readOnly: boolean
  writeOnly: boolean
  deprecated: boolean

  searchString(include: SearchCriteria): string

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, include: SearchCriteria): boolean

}

class Symbol implements ISymbol {
  name: string
  type: IType

  constructor(name: string, type: IType) {
    this.name = name
    this.type = type
  }

  asHashString() {
    return `${this.name}:${this.type.name}`
  }

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean {
    return rx.test(this.searchString(criteria)) || this.type.search(rx, criteria)
  }

  searchString(criteria: Set<SearchCriterion>): string {
    let result = ''
    if (criteria.has(SearchCriterion.name)) result += searchIt(this.name)
    return result
  }
}

interface ISchemadSymbol extends ISymbol {
  /**
   * Original OpenAPI schema reference for this item
   */
  schema: OAS.SchemaObject

  /**
   * Status indicator of this item. Typically 'stable', 'beta', 'experimental', or ''
   */
  status: string

  /**
   * Description of this item
   */
  description: string

  /**
   * True if this item has been deprecated
   */
  deprecated: boolean

  /**
   * If deprecated, 'deprecated'. Otherwise ''
   */
  deprecation: string
}

class SchemadSymbol extends Symbol implements ISchemadSymbol {
  schema: OAS.SchemaObject

  constructor(name: string, type: IType, schema: OAS.SchemaObject) {
    super(name, type)
    this.schema = schema
  }

  get status(): string {
    return this.schema['x-looker-status'] || ''
  }

  get description(): string {
    return this.schema.description || ''
  }

  get deprecated(): boolean {
    return this.schema.deprecated || this.schema['x-looker-deprecated'] || false
  }

  get deprecation(): string {
    return this.deprecated ? 'deprecated' : ''
  }
}

class Property extends SchemadSymbol implements IProperty {
  required: boolean = false

  constructor(name: string, type: IType, schema: OAS.SchemaObject, required: string[] = []) {
    super(name, type, schema)
    this.required = !!(required.includes(name) || schema.required?.includes(name))
  }

  get nullable(): boolean {
    // TODO determine cascading nullable options
    return this.schema.nullable || this.schema['x-looker-nullable'] || false
  }

  get readOnly(): boolean {
    return this.schema.readOnly || false
  }

  get writeOnly(): boolean {
    return this.schema.writeOnly || false
  }

  asHashString() {
    return super.asHashString()
    + this.nullable ? '?' : ''
    + this.readOnly ? ' ro' : ''
    + this.required ? ' req' : ''
    + this.writeOnly ? ' wo' : ''
  }

  searchString(criteria: SearchCriteria): string {
    let result = super.searchString(criteria)
    if (criteria.has(SearchCriterion.description)) result += searchIt(this.description)
    if (criteria.has(SearchCriterion.status)) result += searchIt(this.status) + searchIt(this.deprecation)
    return result
  }

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean {
    return rx.test(this.searchString(criteria)) || this.type.search(rx, criteria)
  }
}

export class Parameter implements IParameter {
  description: string = ''
  location: MethodParameterLocation = 'query'
  name: string
  required: boolean = false
  type: IType

  constructor(param: OAS.ParameterObject | Partial<IParameter>, type: IType) {
    this.name = param.name!
    this.type = type
    this.description = param.description || ''
    if ('in' in param) {
      this.location = param.in
    } else {
      this.location = (param as Partial<IParameter>).location || strBody
    }
    // TODO deal with the required value being the names of the columns that are required
    this.required = param.required || false
  }

  asSchemaObject() {
    return {
      nullable: !(this.required), // || this.location === strBody),
      required: this.required ? [this.name] : undefined,
      readOnly: false,
      writeOnly: false,
      deprecated: false,
      description: this.description,
      type: this.type.name
    } as OAS.SchemaObject
  }

  asProperty() {
    return new Property(this.name, this.type, this.asSchemaObject())
  }

  asHashString() {
    return `${this.name}:${this.type.name}${this.required ? '' : '?'}${this.location}`
  }

  doEncode() {
    return this.type.name === 'string' || this.type.name === 'datetime' || this.type.name === 'date'
  }

  searchString(criteria: Set<SearchCriterion>): string {
    let result = ''
    if (criteria.has(SearchCriterion.name)) result += searchIt(this.name)
    if (criteria.has(SearchCriterion.description)) result += searchIt(this.description)
    return result
  }

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean {
    return rx.test(this.searchString(criteria)) || this.type.search(rx, criteria)
  }
}

/**
 * Properties and methods of an SDK method
 *
 * Everything required to generate a method declaration, and documentation for it,
 * is contained in this interface. Search functionality is also included.
 *
 */
export interface IMethod extends ISchemadSymbol {
  /**
   * alias of ISymbol.name
   */
  operationId: string

  /**
   * HTTP method used for this REST request
   */
  httpMethod: HttpMethod

  /**
   * Relative URL of the endpoint
   */
  endpoint: string

  /**
   * alias of ISymbol.type
   */
  resultType: IType

  /**
   * Prefers 200 response with application/json as the response type
   */
  primaryResponse: IMethodResponse

  /**
   * List of all responses that can be returned by this REST call
   */
  responses: IMethodResponse[]

  /**
   * Description (from the spec) of this method
   */
  description: string

  /**
   * All parameters defined for this method, in natural order from spec processing
   */
  params: IParameter[]

  /**
   * Summary from the method's schema object
   */
  summary: string

  /**
   * Names of path arguments. Not in required/optional priority
   */
  pathArgs: string[]

  /**
   * Primary body argument name ('' if it doesn't exist)
   */
  bodyArg: string

  /**
   * Names of query arguments. Not in required/optional priority
   */
  queryArgs: string[]

  /**
   * Names of header arguments. Not currently used by Codegen
   */
  headerArgs: string[]

  /**
   * Names of cookie arguments. Not currently used by Codegen
   */
  cookieArgs: string[]

  /**
   * Responses that have HTTP error codes (4xx)
   */
  errorResponses: IMethodResponse[]

  /**
   * All required parameters, ordered by location precedence
   */
  requiredParams: IParameter[]

  /**
   * All optional parameters, ordered by location precedence
   */
  optionalParams: IParameter[]

  /**
   * All parameters in the correct, sorted order for the method code generator
   * Parameters are required, by location precedence, then optional, by location precedence
   */
  allParams: IParameter[]

  /**
   * All body parameters in natural order
   */
  bodyParams: IParameter[]

  /**
   * All path parameters in natural order
   */
  pathParams: IParameter[]

  /**
   * All query parameters in natural order
   */
  queryParams: IParameter[]

  /**
   * The types of responses returned by this method (binary and/or string)
   */
  responseModes: Set<ResponseMode>

  /**
   * Value of `x-looker-activity-type` from schema specification
   */
  activityType: string

  /**
   * all type names referenced in this method, including intrinsic types
   */
  types: IKeyList

  /**
   * all non-instrinsic type names referenced in this method
   */
  customTypes: IKeyList

  /**
   * Get a list of parameters for location, or just all parameters
   * @param {MethodParameterLocation} location is optional. defaults to all parameters
   * @returns {IParameter[]} all parameters in natural order matching the location constraing
   */
  getParams(location?: MethodParameterLocation): IParameter[]

  /**
   * return the list of optional parameters, optionally for a specific location
   * @param {MethodParameterLocation} location
   * @returns {IParameter[]}
   */
  optional(location?: MethodParameterLocation): IParameter[]

  /**
   * return the list of required parameters, optionally for a specific location
   */
  required(location?: MethodParameterLocation): IParameter[]

  /**
   * Does this method have optional parameters?
   * @returns {boolean} true if optional parameters exist for this method
   */
  hasOptionalParams(): boolean

  /**
   * Does this method return binary responses?
   * @returns {boolean} true if binary responses are possible
   */
  responseIsBinary() : boolean

  /**
   * Does this method return string responses?
   * @returns {boolean} true if string responses are possible
   */
  responseIsString() : boolean

  /**
   * Does this method return both binary and string responses
   * @returns {boolean} true if both binary and string responses are possible
   */
  responseIsBoth() : boolean

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean

  /**
   * Add a parameter to the method, tracking all cross-reference information
   * @param {IApiModel} api specification containing this method
   * @param {IParameter} param to add to the spec
   * @returns {IMethod} the defined method with parameter and references added
   */
  addParam(api: IApiModel, param: IParameter): IMethod

  /**
   * Add a type to the method, tracking all cross-reference information
   * @param {IApiModel} api specification containing this method
   * @param {IType} type to add to the spec
   * @returns {IMethod} the defined method with parameter and references added
   */
  addType(api: IApiModel, type: IType): IMethod

  /**
   * Sorts parameters by location precedence, then alphanumeric
   * @param {IParameter[]} list
   * @returns {IParameter[]}
   */
  sort(list?: IParameter[]): IParameter[]
}

export class Method extends SchemadSymbol implements IMethod {
  readonly httpMethod: HttpMethod
  readonly endpoint: string
  readonly primaryResponse: IMethodResponse
  responses: IMethodResponse[]
  readonly params: IParameter[]
  readonly responseModes: Set<ResponseMode>
  readonly activityType: string
  readonly customTypes: IKeyList
  readonly types: IKeyList

  constructor(api: IApiModel, httpMethod: HttpMethod, endpoint: string, schema: OAS.OperationObject, params: IParameter[],
              responses: IMethodResponse[], body?: IParameter) {
    if (!schema.operationId) {
      throw new Error('Missing operationId')
    }

    const primaryResponse = responses.find((response) => {
      // prefer json response over all other 200s
      return response.statusCode === StatusCode.OK && response.mediaType === 'application/json'
    }) || responses.find((response) => {
      return response.statusCode === StatusCode.OK // accept any mediaType for 200 if none are json
    }) || responses.find((response) => {
      return response.statusCode === StatusCode.NoContent
    })

    if (!primaryResponse) {
      throw new Error(`Missing 2xx + application/json response in ${endpoint}`)
    }

    super(schema.operationId, primaryResponse.type, schema)
    this.customTypes = new Set<string>()
    this.types = new Set<string>()
    this.httpMethod = httpMethod
    this.endpoint = endpoint
    this.responses = responses
    this.primaryResponse = primaryResponse
    this.responseModes = this.getResponseModes()
    this.params = []
    params.forEach(p => this.addParam(api, p))
    responses.forEach(r => this.addType(api, r.type))
    if (body) {
      this.addParam(api, body)
    }
    this.activityType = schema["x-looker-activity-type"]
  }

  /**
   * Adds the parameter and registers its type for the method
   * @param {IParameter} param
   */
  addParam(api: IApiModel, param: IParameter) {
    this.params.push(param)
    this.addType(api, param.type)
    return this
  }

  /**
   * Adds the type to the method type xrefs and adds the method to the types xref
   * @param {IType} type
   */
  addType(api: IApiModel, type: IType) {
    this.types.add(type.name)
    // Add the method xref to the type
    type.methodRefs.add(this.name)

    const custom = type.customType
    if (custom) {
      this.customTypes.add(custom)
      const customType = api.types[custom]
      customType.methodRefs.add(this.name)
    }
    return this
  }

  /**
   * Determines which response modes (binary/string) this method supports
   * @returns {Set<string>} Either a set of 'string' or 'binary' or both
   */
  private getResponseModes() {
    let modes = new Set<ResponseMode>()
    for (const resp of this.responses) {

      // TODO should we use one of the mime packages like https://www.npmjs.com/package/mime-types for
      // more thorough/accurate coverage?
      const mode = resp.mode
      if (mode !== ResponseMode.unknown) modes.add(mode)
    }

    if (modes.size === 0) {
      throw new Error(`Is ${this.operationId} ${JSON.stringify(this.responses)} binary or string?`)
    }

    return modes
  }

  get resultType(): IType {
    return this.type
  }

  get operationId(): string {
    return this.name
  }

  get summary(): string {
    return this.schema.summary || ''
  }

  // all required parameters ordered by location declaration order
  get requiredParams() {
    return this.required('path')
      .concat(
        this.required(strBody),
        this.required('query'),
        this.required('header'),
        this.required('cookie')
      )
  }

  // all required parameters ordered by location declaration order
  get optionalParams() {
    return this.optional('path')
      .concat(
        this.optional(strBody),
        this.optional('query'),
        this.optional('header'),
        this.optional('cookie')
      )
  }

  // all parameters ordered by required, then optional, location declaration order
  get allParams() {
    return this.requiredParams.concat(this.optionalParams)
  }

  get pathParams() {
    return this.getParams('path')
  }

  get bodyParams() {
    return this.getParams(strBody)
  }

  get queryParams() {
    return this.getParams('query')
  }

  get headerParams() {
    return this.getParams('header')
  }

  get cookieParams() {
    return this.getParams('cookie')
  }

  get pathArgs() {
    return this.argumentNames('path')
  }

  get bodyArg() {
    const body = this.argumentNames(strBody)
    if (body.length === 0) return ''
    return body[0]
  }

  get queryArgs() {
    return this.argumentNames('query')
  }

  get headerArgs() {
    return this.argumentNames('header')
  }

  get cookieArgs() {
    return this.argumentNames('cookie')
  }

  get errorResponses() {
    // TODO use lodash or underscore?
    const result = []
    const map = new Map()
    for (const item of this.responses.filter(r => r.statusCode >= 400)) {
      if (!map.has(item.type.name)) {
        map.set(item.type.name, true)
        result.push(item)
      }
    }
    return result
  }

  getParams(location?: MethodParameterLocation): IParameter[] {
    if (location) {
      return this.params.filter((p) => p.location === location)
    }
    return this.params
  }

  responseIsBinary(): boolean {
    return this.responseModes.has(ResponseMode.binary)
  }

  responseIsString(): boolean {
    return this.responseModes.has(ResponseMode.string)
  }

  responseIsBoth(): boolean {
    return this.responseIsBinary() && this.responseIsString()
  }

  /**
   * order parameters in location precedence
   */
  private locationSorter(a: IParameter, b: IParameter) {
    const remain = 0
    const before = -1
    // const after = 1
    // note: "strBody" is an injected location for simplifying method declarations
    // parameters should be sorted in the following location order:
    const locations = ['path', strBody, 'query', 'header', 'cookie']
    if (a.location === b.location) return remain // no need to re-order

    for (let location of locations) {
      if (a.location === location) {
        return remain // first parameter should stay first
      }
      if (b.location === location) {
        return before // second parameter should move up
      }
    }
    return remain
  }

  sort(list?: IParameter[]) {
    if (!list) list = this.params
    return list
      .sort((a, b) => this.locationSorter(a, b))
  }

  /**
   * return the list of required parameters, optionally for a specific location
   */
  required(location?: MethodParameterLocation) {
    let list = this.params
      .filter((i) => i.required)
    if (location) {
      list = list.filter((i) => i.location === location)
    }
    return list
  }

  // return the list of optional parameters, optionally for a specific location
  optional(location?: MethodParameterLocation) {
    let list = this.params
      .filter((i) => !i.required)
    if (location) {
      list = list.filter((i) => i.location === location)
    }
    return list
  }

  hasOptionalParams() {
    return this.optional().length > 0
  }

  private argumentNames(location?: MethodParameterLocation): string[] {
    return this
      .getParams(location)
      .map(p => p.name)
  }

  isMethodSearch(criteria: SearchCriteria): boolean {
    return criteria.has(SearchCriterion.method)
      || criteria.has(SearchCriterion.status)
      || criteria.has(SearchCriterion.activityType)
  }

  searchString(criteria: SearchCriteria): string {
    // Are we only searching for contained items of the method or not?
    if (!this.isMethodSearch(criteria)) return ''
    let result = super.searchString(criteria)
    if (criteria.has(SearchCriterion.method) && criteria.has(SearchCriterion.description)) {
      result += searchIt(this.description)
    }
    if (criteria.has(SearchCriterion.activityType)) result += searchIt(this.activityType)
    if (criteria.has(SearchCriterion.status)) {
      result += searchIt(this.status) + searchIt(this.deprecation)
    }
    return result
  }

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean {
    let result = rx.test(this.searchString(criteria)) || this.type.search(rx, criteria)
    if (!result && criteria.has(SearchCriterion.argument)) {
      for (let a of this.params) {
        if (a.search(rx, criteria)) {
          result = true
          break
        }
      }
    }
    if (!result && criteria.has(SearchCriterion.response)) {
      for (let r of this.responses) {
        if (r.search(rx, criteria)) {
          result = true
          break
        }
      }
    }
    return result
  }

}

export class Type implements IType {
  readonly name: string
  readonly schema: OAS.SchemaObject
  readonly properties: IPropertyList = {}
  readonly methodRefs: IKeyList = new Set<string>()
  readonly types: IKeyList = new Set<string>()
  readonly customTypes: IKeyList = new Set<string>()
  customType: string
  refCount = 0

  constructor(schema: OAS.SchemaObject, name: string) {
    this.schema = schema
    this.name = name
    this.customType = name
  }

  get writeable(): IProperty[] {
    let result: IProperty[] = []
    Object.entries(this.properties)
      .filter(([_, prop]) => !(prop.readOnly || prop.type.readOnly))
      .forEach(([_, prop]) => result.push(prop))
    return result
  }

  get status(): string {
    return this.schema['x-looker-status'] || ''
  }

  get deprecated(): boolean {
    return this.schema.deprecated || this.schema['x-looker-deprecated'] || false
  }

  get description(): string {
    return this.schema.description || ''
  }

  get title(): string {
    return this.schema.title || ''
  }

  get default(): string | undefined {
    return this.schema.default || ''
  }

  get readOnly(): boolean {
    return Object.entries(this.properties).every(([_, prop]) => prop.readOnly)
  }

  load(symbols: ISymbolTable): void {
    Object.entries(this.schema.properties || {}).forEach(([propName, propSchema]) => {
      const propType = symbols.resolveType(propSchema)
      this.types.add(propType.name)
      const customType = propType.customType
      if (customType) this.customTypes.add(customType)
      this.properties[propName] = new Property(propName, propType, propSchema, this.schema.required)
    })
  }

  asHashString() {
    let result = `${this.name}:`
    Object.entries(this.properties)
      // put properties in alphabetical order first
      .sort(([a, _], [b, __]) => a.localeCompare(b))
      .forEach(([_, prop]) => {
        result += prop.asHashString() + ':'
      })
    return result
  }

  /**
   * Is this type directly recursive?
   * @returns {boolean} Does this type contain references to itself as a top-level property?
   */
  isRecursive(): boolean {
    const selfType = this.name
    // test for directly recursive type references
    return Object.entries(this.properties)
      .some(([_, prop]) => prop.type.name === selfType)
  }

  private static isPropSearch(criteria: SearchCriteria) : boolean {
    return criteria.has(SearchCriterion.status)
      || criteria.has(SearchCriterion.property)
  }

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(rx: RegExp, criteria: SearchCriteria): boolean {
    if (!criteria.has(SearchCriterion.type) && !criteria.has(SearchCriterion.status)) return false
    let result = rx.test(this.searchString(criteria))
    if (!result && Type.isPropSearch(criteria)) {
      for (const [, p] of Object.entries(this.properties)) {
        if (p.search(rx, criteria)) {
          result = true
          break
        }
      }
    }
    return result
  }

  searchString(criteria: SearchCriteria): string {
    let result = ''
    if (criteria.has(SearchCriterion.name)) result += searchIt(this.name)
    if (criteria.has(SearchCriterion.description)) result += searchIt(this.description)
    if (criteria.has(SearchCriterion.title)) result += searchIt(this.title)
    if (criteria.has(SearchCriterion.status)) {
      result += searchIt(this.status)
      if (this.deprecated) result += searchIt('deprecated')
    }
    return result
  }
}

export class ArrayType extends Type {

  constructor(public elementType: IType, schema: OAS.SchemaObject) {
    super(schema, `${elementType.name}[]`)
    this.customType = elementType.customType
  }

  get readOnly() {
    return this.elementType.readOnly
  }

}

export class DelimArrayType extends Type {
  constructor(public elementType: IType, schema: OAS.SchemaObject) {
    super(schema, `DelimArray<${elementType.name}>`)
    this.elementType = elementType
    this.customType = elementType.customType
  }

  get readOnly() {
    return this.elementType.readOnly
  }

}

export class HashType extends Type {
  elementType: IType

  constructor(elementType: IType, schema: OAS.SchemaObject) {
    super(schema, `Hash[${elementType.name}`)
    this.elementType = elementType
    this.customType = elementType.customType
  }

  get readOnly() {
    return this.elementType.readOnly
  }

}

export class IntrinsicType extends Type {
  constructor(name: string) {
    super({}, name)
    this.customType = ''
  }

  get readOnly(): boolean {
    return false
  }
}

export class RequestType extends Type {
  constructor(api: IApiModel, name: string, params: IParameter[], description: string = '') {
    super({description}, name)
    // params.forEach(p => this.properties[p.name] = p.asProperty())
    params.forEach(p => {
      let writeProp = p.asProperty()
      const typeWriter = api.getWriteableType(p.type)
      if (typeWriter) writeProp.type = typeWriter
      this.properties[p.name] = writeProp
    })
  }
}

export class WriteType extends Type {
  constructor(api: IApiModel, type: IType) {
    const name = `${strWrite}${type.name}`
    const description = `Dynamically generated writeable type for ${type.name}`
    super({description}, name)
    type.writeable
      .filter(p => (!p.readOnly) && (!p.type.readOnly))
      .forEach(p => {
        let writeProp = new Property(p.name, p.type,
          {
            description: p.description,
            // nullable/optional if property is nullable or property is complex type
            nullable: p.nullable || !(p.type instanceof IntrinsicType)
          }, type.schema.required)
        const typeWriter = api.getWriteableType(p.type)
        if (typeWriter) writeProp.type = typeWriter
        this.properties[p.name] = writeProp
      })
  }
}

export interface IApiModel extends IModel {
  version: string
  description: string
  methods: IMethodList
  types: ITypeList
  tags: ITagList

  sortedTypes(): IType[]

  sortedMethods(): IMethod[]

  getRequestType(method: IMethod): IType | undefined

  getWriteableType(type: IType): IType | undefined

  /**
   * Search this item for a regular expression pattern
   * @param {string} expression text or regex  to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(expression: string, criteria: SearchCriteria): ISearchResult
}

export class ApiModel implements ISymbolTable, IApiModel {
  readonly schema: OAS.OpenAPIObject | undefined
  readonly methods: IMethodList = {}
  readonly types: ITypeList = {}
  readonly requestTypes: ITypeList = {}
  readonly tags: ITagList = {}
  private refs: ITypeList = {}


  constructor(spec: OAS.OpenAPIObject) {
    ['string', 'integer', 'int64', 'boolean', 'object',
      'uri', 'float', 'double', 'void', 'datetime', 'email',
      'uuid', 'uri', 'hostname', 'ipv4', 'ipv6',
    ].forEach((name) => this.types[name] = new IntrinsicType(name))

    this.schema = spec
    this.load()
  }

  get version(): string {
    return this.schema?.version || ''
  }

  get description(): string {
    return this.schema?.decription?.trim() || ''
  }

  static fromString(specContent: string): ApiModel {
    const json = JSON.parse(specContent)
    return this.fromJson(json)
  }

  static fromJson(json: any): ApiModel {
    const spec = new OAS.OpenApiBuilder(json).getSpec()
    return new ApiModel(spec)
  }

  private static isModelSearch(criteria: SearchCriteria) : boolean {
    return criteria.has(SearchCriterion.method)
      || criteria.has(SearchCriterion.argument)
      || criteria.has(SearchCriterion.response)
      || criteria.has(SearchCriterion.status)
      || criteria.has(SearchCriterion.activityType)
  }

  private static isTypeSearch(criteria: SearchCriteria) : boolean {
    return criteria.has(SearchCriterion.type)
      || criteria.has(SearchCriterion.title)
      || criteria.has(SearchCriterion.status)
  }

  private static addMethodToTags(tags:ITagList, method: IMethod) : ITagList {
    for (let tag of method.schema.tags) {
      let list: IMethodList = tags[tag]
      if (!list) {
        list = {}
        list[method.name] = method
        tags[tag] = list
      } else {
        list[method.name] = method
      }
    }
    return tags
  }

  private tagMethod(method: IMethod) {
    return ApiModel.addMethodToTags(this.tags, method)
  }

  /**
   * Search this item for a regular expression pattern
   * @param {RegExp} rx regular expression to match
   * @param {SearchCriteria} criteria items to examine for the search
   * @returns {boolean} true if the pattern is found in the specified criteria
   */
  search(expression: string, criteria: SearchCriteria = SearchAll): ISearchResult {
    let tags: ITagList = {}
    let types: ITypeList = {}
    let result = {
      tags,
      types,
      message: 'Search done'
    }

    let rx: RegExp
    try {
      rx = new RegExp(expression, "mi") // multi-line case insensitive, not global so first match returns
    } catch (e) {
      result.message = `Error: Invalid search expression ${e}`
      return result
    }

    if (ApiModel.isModelSearch(criteria)) {
      Object.entries(this.methods).forEach(([, method]) => {
        if (method.search(rx, criteria)) {
          ApiModel.addMethodToTags(tags, method)
        }
      })
    }
    if (ApiModel.isTypeSearch(criteria)) {
      Object.entries(this.types).forEach(([key, type]) => {
        if (type.search(rx, criteria)) {
          types[key] = type
        }
      })
    }
    return result
  }

  // TODO replace this with get from underscore?
  jsonPath(path: string | string[], item: any = this.schema, splitter: string = '/') {
    let keys = path
    if (!(path instanceof Array)) {
      keys = path.split(splitter)
    }
    for (let key of keys) {
      if (key === '#') continue
      item = item[key]
      if (item == null) return null
    }
    return item
  }

  /**
   *   Retrieve an api object via its JSON path
   */
  resolveType(schema: string | OAS.SchemaObject | OAS.ReferenceObject, style?: string): IType {
    if (typeof schema === 'string') {
      if (schema.indexOf('/requestBodies/') < 0) return this.types[schema.substr(schema.lastIndexOf('/') + 1)]
      // dereference the request strBody schema reference
      const deref = this.jsonPath(schema)
      if (deref) {
        const ref = this.jsonPath(['content', 'application/json', 'schema', '$ref'], deref)
        if (ref) return this.resolveType(ref)
      }
    } else if (OAS.isReferenceObject(schema)) {
      return this.refs[schema.$ref]
    } else if (schema.type) {
      if (schema.type === 'integer' && schema.format === 'int64') {
        return this.types['int64']
      }
      if (schema.type === 'number' && schema.format) {
        return this.types[schema.format]
      }
      if (schema.type === 'array' && schema.items) {
        if (style === 'simple') {
          // FKA 'csv'
          return new DelimArrayType(this.resolveType(schema.items), schema)
        }
        return new ArrayType(this.resolveType(schema.items), schema)
      }
      if (schema.type === 'object' && schema.additionalProperties) {
        if (schema.additionalProperties !== true) {
          return new HashType(this.resolveType(schema.additionalProperties), schema)
        }
      }
      if (schema.format === 'date-time') {
        return this.types['datetime']
      }
      if (schema.format && this.types[schema.format]) {
        return this.types[schema.format]
      }
      if (this.types[schema.type]) {
        return this.types[schema.type]
      }
    }
    throw new Error('Schema must have a ref or a type')
  }

  // add to this.requestTypes collection with hash as key
  makeRequestType(hash: string, method: IMethod) {
    const name = `${strRequest}${camelCase('_' + method.name)}`
    const request = new RequestType(this, name, method.allParams,
      `Dynamically generated request type for ${method.name}`)
    this.types[name] = request
    this.requestTypes[hash] = request
    return request
  }

  // create request type from method parameters
  // add to this.types collection with name as key

  // only gets the request type if more than one method parameter is optional
  getRequestType(method: IMethod) {
    if (method.optionalParams.length <= 1) return undefined
    // matches method params hash against current request types
    let paramHash = ''
    method.allParams.forEach(p => paramHash += p.asHashString())
    const hash = md5(paramHash)
    // if no match, creates the request type and increments its refCount for inclusion
    // in generated imports
    let result = this.requestTypes[hash]
    if (!result) result = this.makeRequestType(hash, method)
    if (result) result.refCount++
    return result
  }

  makeWriteableType(hash: string, type: IType) {
    const writer = new WriteType(this, type)
    this.types[writer.name] = writer
    this.requestTypes[hash] = writer
    return writer
  }

  // a writeable type will need to be found or created
  getWriteableType(type: IType) {
    const props = Object.entries(type.properties).map(([_, prop]) => prop)
    const writes = type.writeable
    // do we have any readOnly properties?
    if (writes.length === 0 || writes.length === props.length) return undefined
    const hash = md5(type.asHashString())
    let result = this.requestTypes[hash]
    if (!result) result = this.makeWriteableType(hash, type)
    return result
  }

  // if any properties of the parameter type are readOnly (including in subtypes)

  sortedTypes() {
    return Object.values(this.types)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  sortedMethods() {
    return Object.values(this.methods)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  private load(): void {
    if (this.schema?.components?.schemas) {
      Object.entries(this.schema.components.schemas).forEach(([name, schema]) => {
        const t = new Type(schema, name)
        // types[n] and corresponding refs[ref] MUST reference the same type instance!
        this.types[name] = t
        this.refs[`#/components/schemas/${name}`] = t
      })
      Object.keys(this.schema.components.schemas).forEach((name) => {
        (this.resolveType(name) as Type).load(this)
      })
    }

    if (this.schema?.paths) {
      Object.entries(this.schema.paths).forEach(([path, schema]) => {
        const methods = this.loadMethods(path, schema)
        methods.forEach((method) => {
          this.methods[method.name] = method
        })
      })
    }
  }

  private loadMethods(endpoint: string, schema: OAS.PathItemObject): Method[] {
    const methods: Method[] = []

    const addIfPresent = (httpMethod: HttpMethod, opSchema: OAS.OperationObject | undefined) => {
      if (opSchema) {
        const responses = this.methodResponses(opSchema)
        const params = this.methodParameters(opSchema)
        const body = this.requestBody(opSchema.requestBody)
        const method = new Method(this, httpMethod, endpoint, opSchema, params, responses, body)
        methods.push(method)
        this.tagMethod(method)
      }
    }

    addIfPresent('GET', schema.get)
    addIfPresent('PUT', schema.put)
    addIfPresent('POST', schema.post)
    addIfPresent('PATCH', schema.patch)
    addIfPresent('DELETE', schema.delete)
    // options?: OperationObject;
    // head?: OperationObject;
    // trace?: OperationObject;
    return methods
  }

  private methodResponses(schema: OAS.OperationObject): IMethodResponse[] {
    const responses: IMethodResponse[] = []
    Object.entries(schema.responses).forEach(([statusCode, contentSchema]) => {
      const desc = contentSchema.description || ''
      if (contentSchema.content) {

        Object.entries(contentSchema.content).forEach(([mediaType, response]) => {
          responses.push(new MethodResponse(parseInt(statusCode, 10), mediaType,
            this.resolveType((response as OAS.MediaTypeObject).schema || {}), desc))
        })
      } else if (statusCode === '204') {
        // no content - returns void
        responses.push(new MethodResponse(204, '', this.types['void'],desc || 'No content'))
      }
    })
    return responses
  }

  private methodParameters(schema: OAS.OperationObject): IParameter[] {
    const params: IParameter[] = []
    if (schema.parameters) {
      for (let p of schema.parameters) {
        let type: IType
        let param: OAS.ParameterObject
        if (OAS.isReferenceObject(p)) {
          // TODO make this work correctly for reference objects at the parameter level
          // TODO is style resolution like below required here?
          type = this.resolveType(p)
          param = {
            name: type.name,
            in: 'query',
          }
        } else {
          type = this.resolveType(p.schema || {}, p.style)
          param = p
        }
        const mp = new Parameter(param, type)
        params.push(mp)
      }
    }
    return params
  }

  private requestBody(obj: OAS.RequestBodyObject | OAS.ReferenceObject | undefined) {
    if (!obj) return undefined

    let required = true
    if (!OAS.isReferenceObject(obj)) {
      const req = obj as OAS.RequestBodyObject
      if ('required' in req) {
        required = req.required!
      }
    }

    const typeSchema: OAS.SchemaObject = {
      nullable: false,
      required: required ? [strBody] : [],
      readOnly: false,
      writeOnly: false,
      deprecated: false,
      description: ''
    }

    // default the type to a plain body
    let type: IType = new Type(typeSchema, strBody)

    if (OAS.isReferenceObject(obj)) {
      // get the type directly from the ref object
      type = this.resolveType(obj.$ref)

    } else if (obj.content) {
      // determine type from content
      const content = obj.content
      // TODO need to understand headers or links
      Object.keys(content).forEach(key => {
        const media = content[key]
        const schema = media.schema!
        if (OAS.isReferenceObject(schema)) {
          type = this.resolveType(schema.$ref)
        } else {
          type = this.resolveType(schema)
        }
      })

    } else {
      // TODO must be dynamic, create type
    }

    let result = new Parameter({
      name: strBody,
      location: strBody,
      required: required,
      description: '', // TODO capture description
    } as Partial<IParameter>, type)

    return result
  }

}

export interface IMappedType {
  name: string
  default: string
}

export interface ICodeGen {

  /**
   * root path for generated source code files
   * e.g. 'python' for Python
   */
  codePath: string

  /**
   * current version of the Api being generated
   */
  apiVersion: string

  /**
   * beginning name pattern for all environment variables
   * e.g. LOOKERSDK
   */
  environmentPrefix: string

  /**
   * folder for the Looker SDK reference
   * e.g. 'looker_sdk' for Python. All python source would end up under `python/looker_sdk`
   */
  packagePath: string

  /**
   * folder for the Looker SDK reference
   * e.g. 'looker_sdk' for Python. All python source would end up under `python/looker_sdk`
   */
  packageName: string

  /**
   * name of api request instance variable
   * e.g. _rtl for Python, transport for TypeScript
   */
  transport: string

  /**
   * reference to self. e.g self, this, it, etc.
   */
  itself: string

  /**
   * file extension for generated files
   */
  fileExtension: string

  /**
   * comment string
   * e.g. Python=# C#=// TypeScript=//
   */
  commentStr: string

  /**
   * string representation of null value
   * e.g. Python None, C# null, Delphi nil
   */
  nullStr: string

  /**
   * indentation string. Typically two spaces '  '
   */
  indentStr: string

  /**
   * end type string. For C# and TypeScript, usually '}\n'
   */
  endTypeStr: string

  /**
   * argument separator string. Typically ', '
   */
  argDelimiter: string

  /**
   * parameter delimiter. Typically ",\n"
   */
  paramDelimiter: string

  /**
   * property delimiter. Typically, ",\n"
   */
  propDelimiter: string

  /**
   * Does this language require request types to be generated because it doesn't
   * conveniently support named default parameters?
   */
  needsRequestTypes: boolean

  /**
   * Does this language support specific streaming methods?
   */
  willItStream: boolean

  /**
   * versions used for generating the SDK
   */
  versions?: IVersionInfo

  /**
   * Returns true if the SDK supports multiple API versions of models
   * @returns {boolean} True if multi-API is supported
   */
  supportsMultiApi() : boolean

  /**
   * Returns the name of the RequestType if this language AND method require it.
   * Otherwise return empty string.
   * @param {IMethod} method
   * @returns {string}
   */
  requestTypeName(method: IMethod): string

  //
  /**
   * Returns the WriteType if the passed type has any readOnly properties or types
   * @param {IType} type
   * @returns {IType | undefined}
   */
  writeableType(type: IType): IType | undefined

  //
  /**
   * standard code to insert at the top of the generated "methods" file(s)
   * @param {string} indent
   * @returns {string}
   */
  methodsPrologue(indent: string): string

  //
  /**
   * standard code to append to the bottom of the generated "methods" file(s)
   * @param {string} indent
   * @returns {string}
   */
  methodsEpilogue(indent: string): string

  /**
   * standard code to insert at the top of the generated "streams" file(s)
   * @param {string} indent
   * @returns {string}
   */
  streamsPrologue(indent: string): string

  /**
   * standard code to insert at the top of the generated "models" file(s)
   * @param {string} indent indentation string
   * @returns {string}
   */
  modelsPrologue(indent: string): string

  /**
   * standard code to append to the bottom of the generated "models" file(s)
   * @param {string} indent indentation string
   * @returns {string}
   */
  modelsEpilogue(indent: string): string

  /**
   * Get the name of an SDK file complete with API version
   * @param {string} baseFileName e.g. "methods" or "models"
   * @returns {string} fully specified, API-version-specific file name
   */
  sdkFileName(baseFileName: string) : string

  /**
   * provide the name for a file with the appropriate language code extension
   * @param {string} base eg "methods" or "models"
   * @returns {string} full sdk file name complete with extension
   */
  fileName(base: string): string

  // generate an optional comment header if the comment is not empty
  commentHeader(indent: string, text: string | undefined): string

  // group argument names together
  // e.g.
  //   [ row_size, page_offset ]
  argGroup(indent: string, args: Arg[], prefix?: string): string

  // list arguments by name
  // e.g.
  //   row_size, page_offset
  argList(indent: string, args: Arg[], prefix?: string): string

  // generate a comment block
  // e.g.
  //   # this is a
  //   # multi-line comment block
  comment(indent: string, description: string): string

  // generates the method signature including parameter list and return type.
  methodSignature(indent: string, method: IMethod): string

  // convert endpoint pattern to platform-specific string template
  httpPath(path: string, prefix?: string): string

  // generate a call to the http API abstraction
  // includes http method, path, body, query, headers, cookie arguments
  httpCall(indent: string, method: IMethod): string

  // generate a call to the stream API abstraction
  // includes http method, path, body, query, headers, cookie arguments
  streamCall(indent: string, method: IMethod): string

  // generates the type declaration signature for the start of the type definition
  typeSignature(indent: string, type: IType): string

  // generates summary text
  // e.g, for Python:
  //    '''This is the method summary'''
  summary(indent: string, text: string): string

  // produces the declaration block for a parameter
  // e.g.
  //   # ID of the query to run
  //   query_id: str
  //
  // and
  //
  //   # size description of parameter
  //   row_limit: int = None
  declareParameter(indent: string, param: IParameter): string

  // generates the method signature including parameter list and return type.
  methodSignature(indent: string, method: IMethod): string

  /**
   * Handles the encoding call for path parameters within method declarations
   * @param {string} indent how much indent
   * @param {IMethod} method structure of method to declare
   * @returns {string} indentation strings
   */
  encodePathParams(indent: string, method: IMethod): string

  // generates the entire method
  declareMethod(indent: string, method: IMethod): string

  // generates the streaming method signature including parameter list and return type.
  streamerSignature(indent: string, method: IMethod): string

  // generates the entire streaming method
  declareStreamer(indent: string, method: IMethod): string

  // generates the list of parameters for a method signature
  // e.g.
  //   # ID of the query to run
  //   query_id: str,
  //   # size description of parameter
  //   row_limit: int = None
  declareParameters(indent: string, params: IParameter[] | undefined): string

  // generates the syntax for a constructor argument
  declareConstructorArg(indent: string, property: IProperty): string

  // produces the code for the type constructor
  construct(indent: string, type: IType): string

  // generates entire type declaration
  declareType(indent: string, type: IType): string

  // generates a textual description for the property's comment header
  describeProperty(property: IProperty): string

  // generates type property
  declareProperty(indent: string, property: IProperty): string

  // if countError is false, no import reference to Error or IError should be included
  typeNames(countError: boolean): string[]

  typeMap(type: IType): IMappedType

}
