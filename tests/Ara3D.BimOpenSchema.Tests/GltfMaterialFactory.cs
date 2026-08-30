using Ara3D.Geometry;
using SharpGLTF.Schema2;

namespace Ara3D.BIMOpenSchema.Tests;

public static class GltfMaterialFactory
{
    public static Models.Material Create(Material material)
    {
        var r = Models.Material.Default;
        var baseColor = material.FindChannel("BaseColor");
        if (baseColor.HasValue)
        {
            var ps = baseColor.Value.Parameters;
            if (ps.Count != 1)
                throw new Exception("BaseColor Material channel parameters are not 1");

            if (ps[0].Value is System.Numerics.Vector4 vec4)
                r = r.WithColor((vec4.X, vec4.Y, vec4.Z, vec4.W));
            else
                throw new Exception($"BaseColor channel has unexpected type");
        }
        var metallicRoughness = material.FindChannel("MetallicRoughness");
        if (metallicRoughness.HasValue)
        {
            var ps = baseColor.Value.Parameters;
            if (ps.Count != 1)
                throw new Exception("MetallicRoughness Material channel parameters are not 1");
            if (ps[0].Value is System.Numerics.Vector4 vec4)
            {
                r = new(r.Color, vec4.X, vec4.Y);
            }
            else
            {
                throw new Exception($"MetallicRoughness channel has unexpected type");
            }
        }
        var diffuse = material.FindChannel("Diffuse");
        if (!baseColor.HasValue && diffuse.HasValue)
        {
            var ps = baseColor.Value.Parameters;
            if (ps.Count != 1)
                throw new Exception("Diffuse Material channel parameters are not 1");
            if (ps[0].Value is System.Numerics.Vector4 vec4)
            {
                r = r.WithColor((vec4.X, vec4.Y, vec4.Z, vec4.W));
            }
            else
            {
                throw new Exception($"Diffuse channel has unexpected type");
            }
        }
        var specularGlossiness = material.FindChannel("SpecularGlossiness");
        if (!metallicRoughness.HasValue && specularGlossiness.HasValue)
        {
            var ps = baseColor.Value.Parameters;
            if (ps.Count != 1)
                throw new Exception("Diffuse Material channel parameters are not 1");
            if (ps[0].Value is System.Numerics.Vector4 vec4)
            {
                var specColor = new Vector3(vec4.X, vec4.Y, vec4.Z);
                var glossiness = vec4.W;
                ConvertSpecGlossToMetalRough(
                    new Vector3(r.Color.R, r.Color.G, r.Color.B),
                    specColor,
                    glossiness,
                    out var metallic,
                    out var roughness);
                r = new(r.Color, metallic, roughness);
            }
            else
            {
                throw new Exception();
            }
        }

        return r;
    }

    // TODO: validates this code and move it to the models project. 

    /// <summary>
    /// Converts a Specular-Glossiness PBR material to Metallic-Roughness values.
    /// </summary>
    /// <param name="diffuseColor">Diffuse (albedo) color in linear space (RGB each in [0,1]).</param>
    /// <param name="specularColor">Specular color in linear space (RGB each in [0,1]).</param>
    /// <param name="glossiness">Glossiness factor [0,1] (1 = perfectly smooth).</param>
    /// <param name="metallic">Output metallic value [0,1].</param>
    /// <param name="roughness">Output roughness value [0,1].</param>
    public static void ConvertSpecGlossToMetalRough(
        Vector3 diffuseColor,
        Vector3 specularColor,
        float glossiness,
        out float metallic,
        out float roughness)
    {
        // 1) Roughness is simply the inverse of glossiness:
        //    Gloss maps (bright = smooth) ↔ Roughness maps (bright = rough) :contentReference[oaicite:0]{index=0}
        roughness = 1.0f - glossiness;

        // 2) Compute brightness terms for diffuse and specular (luma of squared values):
        //    DiffuseBrightness = 0.299·R² + 0.587·G² + 0.114·B²
        //    SpecularBrightness = same formula on specularColor 
        var diffuseBrightness =
            0.299f * diffuseColor.X * diffuseColor.X +
            0.587f * diffuseColor.Y * diffuseColor.Y +
            0.114f * diffuseColor.Z * diffuseColor.Z;

        var specularBrightness =
            0.299f * specularColor.X * specularColor.X +
            0.587f * specularColor.Y * specularColor.Y +
            0.114f * specularColor.Z * specularColor.Z;

        // 3) Use the maximum channel as the specular “strength”:
        var specularStrength = Math.Max(specularColor.X,
            Math.Max(specularColor.Y, specularColor.Z));

        // 4) Solve for metallic m in the quadratic arising from energy conservation:
        //    A = dielectric specular reflectance (≈0.04)
        //    B = (DiffuseBrightness * ((1 - specStrength)/(1 - A)) + SpecularBrightness) - 2A
        //    C = A - SpecularBrightness
        //    m = clamp((–B + sqrt(B² - 4AC)) / (2A), 0, 1) 
        const float A = 0.04f;
        var oneMinusSpec = 1.0f - specularStrength;
        var B = (diffuseBrightness * (oneMinusSpec / (1.0f - A)) + specularBrightness) - 2.0f * A;
        var C = A - specularBrightness;
        var disc = B * B - 4.0f * A * C;
        var sqrtDisc = (float)Math.Sqrt(Math.Max(0.0f, disc));
        metallic = (-B + sqrtDisc) / (2.0f * A);
        metallic = metallic.ClampZeroOne();
    }
}