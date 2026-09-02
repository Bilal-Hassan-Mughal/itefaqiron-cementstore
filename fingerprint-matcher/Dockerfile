FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY FingerprintMatcher/FingerprintMatcher.csproj FingerprintMatcher/
RUN dotnet restore FingerprintMatcher/FingerprintMatcher.csproj
COPY FingerprintMatcher/ FingerprintMatcher/
RUN dotnet publish FingerprintMatcher/FingerprintMatcher.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "FingerprintMatcher.dll"]
