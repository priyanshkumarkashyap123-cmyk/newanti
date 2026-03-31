use std::env;

fn main() {
    let proto_file = "../../packages/schema/structure.proto";
    println!("cargo:rerun-if-changed={proto_file}");
    env::set_var("PROTOC", protobuf_src::protoc());
    prost_build::Config::new()
        .out_dir(env::var("OUT_DIR").expect("OUT_DIR not set"))
        .compile_protos(&[proto_file], &["../../packages/schema"])
        .expect("failed to compile protos");
}
