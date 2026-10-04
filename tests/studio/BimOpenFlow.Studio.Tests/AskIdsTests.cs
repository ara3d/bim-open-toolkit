namespace BimOpenFlow.Studio.Tests;

public sealed class AskIdsTests
{
    [Test]
    public void KeepsTheContentWordsOfTheRequest()
        => Assert.That(AskIds.For("How many rooms are on each storey? Sort by count, largest first.", _ => false),
            Is.EqualTo("ask-rooms-storey-sort-count-largest"));

    [Test]
    public void SuffixesWhenTaken()
    {
        var taken = new HashSet<string> { "ask-rooms", "ask-rooms-2" };
        Assert.That(AskIds.For("rooms", taken.Contains), Is.EqualTo("ask-rooms-3"));
    }

    [Test]
    public void EmptyOrStopWordOnlyRequestsStillGetAnId()
        => Assert.That(AskIds.For("show me the", _ => false), Is.EqualTo("ask-graph"));

    [Test]
    public void LongRequestsAreCut()
    {
        var id = AskIds.For("extraordinarily complicated multidimensional visualisation pipeline description", _ => false);
        Assert.That(id.Length, Is.LessThanOrEqualTo(48));
        Assert.That(id, Does.StartWith("ask-extraordinarily"));
    }
}
