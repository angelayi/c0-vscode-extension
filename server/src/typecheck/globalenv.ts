import * as ast from "../ast";
import { ImpossibleError } from "../error";

export type GlobalEnv = {
    readonly libstructs: Set<string>;
    readonly libfuncs: Set<string>;
    readonly decls: ast.Declaration[];
};

/**
 * An ActualType is the (non-identifier) type that can be typedefed.
 */
export type ActualType =
    | ast.IntType
    | ast.BoolType
    | ast.StringType
    | ast.CharType
    | ast.PointerType
    | ast.ArrayType
    | ast.StructType
    | { tag: "NamedFunctionType"; definition: ast.FunctionDeclaration };

/**
 * Look at a typedef
 */
export function getTypeDef(genv: GlobalEnv, t: string): ActualType | ast.ValueType | null {
    for (let decl of genv.decls) {
        if (decl.tag === "TypeDefinition" && decl.definition.id.name === t) {
            return decl.definition.kind;
        } else if (decl.tag === "FunctionTypeDefinition" && decl.definition.id.name === t) {
            return {
                tag: "NamedFunctionType",
                definition: decl.definition
            };
        }
    }
    return null;
}

export function initEmpty(): GlobalEnv {
    return {
        libstructs: new Set<string>(),
        libfuncs: new Set<string>(),
        decls: []
    };
}

/**
 * Create an initial GlobalEnv with the correct type for main()
 */
export function initMain(): GlobalEnv {
    return {
        libstructs: new Set<string>(),
        libfuncs: new Set<string>(),
        decls: [
            {
                tag: "FunctionDeclaration",
                returns: { tag: "IntType" },
                id: { tag: "Identifier", name: "main" },
                params: [],
                preconditions: [],
                postconditions: [],
                body: null
            }
        ]
    };
}

/**
 * Insert a (typechecked) declaration into the global environment.
 */
export function addDecl(library: boolean, genv: GlobalEnv, decl: ast.Declaration) {
    genv.decls.push(decl);
    if (library) {
        if (decl.tag === "StructDeclaration") { genv.libstructs.add(decl.id.name); }
        if (decl.tag === "FunctionDeclaration") { genv.libfuncs.add(decl.id.name); }
    }
}

/**
 * Checks if an identifier is a known library function.
 */
export function isLibraryFunction(genv: GlobalEnv, t: string): boolean {
    return genv.libfuncs.has(t);
}

/**
 * Checks if an identifier is a known library struct.
 */
export function isLibraryStruct(genv: GlobalEnv, t: string): boolean {
    return genv.libfuncs.has(t);
}

/**
 * Given an ostensible function name, get the relevant function definition (if one exists), or the
 * latest function declaration (if no definition exists). No declaration may exist; the function will
 * then return 'null'.
 */
export function getFunctionDeclaration(genv: GlobalEnv, t: string): ast.FunctionDeclaration | null {
    let result: ast.FunctionDeclaration | null = null;
    for (let decl of genv.decls) {
        if (decl.tag === "FunctionDeclaration" && decl.id.name === t) {
            if (result === null) { result = decl; }
            if (decl.body !== null) { return decl; }
        }
    }
    return result;
}

/**
 * Given 'struct foobar', this function looks up the operative definition or declaration for
 * 'foobar'. No declaration may exist; the function will then return 'null'.
 */
export function getStructDefinition(genv: GlobalEnv, t: string): ast.StructDeclaration | null {
    let result: ast.StructDeclaration | null = null;
    for (let decl of genv.decls) {
        if (decl.tag === "StructDeclaration" && decl.id.name === t) {
            if (result === null) { result = decl; }
            if (decl.definitions !== null) { return decl; }
        }
    }
    return result;
}

/**
 * If parsing is and environment-threading are done correctly, type identifiers should always
 * be in the global environment.
 */
function expandTypeDef(genv: GlobalEnv, t: ast.Identifier): ActualType {
    let tp = getTypeDef(genv, t.name);

    /* instanbul ignore if */
    if (tp === null) {
        throw new ImpossibleError(`Could not lookup ${t.name}`);
    } else if (tp.tag === "Identifier") {
        return expandTypeDef(genv, tp);
    } else {
        return tp;
    }
}

/**
 * Given an ast.Type, return an identifier-free variant of that type
 */
export function actualType(genv: GlobalEnv, t: ActualType | ast.Type): ActualType | ast.VoidType {
    return t.tag === "Identifier" ? expandTypeDef(genv, t) : t;
}

export function fullTypeName(genv: GlobalEnv, t: ActualType | ast.Type): string {
    const typ = actualType(genv, t);
    switch (typ.tag) {
        case "VoidType":
            return `void`;
        case "BoolType":
            return `bool`;
        case "IntType":
            return `int`;
        case "StructType":
            return `struct ${typ.id.name}`;
        case "CharType":
            return `char`;
        case "StringType":
            return `string`;
        case "PointerType":
            return `${fullTypeName(genv, typ.argument)}*`;
        case "ArrayType":
            return `${fullTypeName(genv, typ.argument)}[]`;
        case "NamedFunctionType":
            return typ.definition.id.name;
        default:
            throw new ImpossibleError("Impossible");
    }
}

export function concreteType(genv: GlobalEnv, t: ActualType | ast.Type): ast.ConcreteType {
    const typ = actualType(genv, t);
    switch (typ.tag) {
        case "VoidType":
            throw new ImpossibleError("concreteType: VoidType");
        case "BoolType":
        case "IntType":
        case "StructType":
        case "CharType":
        case "StringType":
            return typ;
        case "PointerType": {
            if (typ.argument.tag === "VoidType") { return { tag: "TaggedPointerType" }; }
            return { tag: "PointerType" };
        }
        case "ArrayType":
            return { tag: "ArrayType" };
        case "NamedFunctionType":
            throw new ImpossibleError("concreteType: NamedFunctionType");
        default:
            throw new ImpossibleError("Impossible");
    }
}
